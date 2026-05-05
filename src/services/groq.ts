import axios, { type AxiosInstance, isAxiosError } from "axios";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GroqClientConfig {
  apiKey: string;
  baseUrl?: string | undefined;
  model?: string | undefined;
  visionModel?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  maxRetries?: number | undefined;
}

interface GroqAPIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Parse "try again in Xs" from Groq 429 messages. Returns milliseconds. */
function parseRetryAfterMs(message: string): number {
  const match = /try again in (\d+(?:\.\d+)?)s/i.exec(message);
  if (match?.[1]) return Math.ceil(parseFloat(match[1]) * 1000) + 200; // +200ms buffer
  return 10_000; // safe default
}

export class GroqService {
  private readonly client: AxiosInstance;
  private readonly model: string;
  private readonly visionModel: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly maxRetries: number;

  constructor(config: GroqClientConfig) {
    this.model = config.model ?? "llama-3.3-70b-versatile";
    this.visionModel = config.visionModel ?? "meta-llama/llama-4-scout-17b-16e-instruct";
    this.temperature = config.temperature ?? 0.3; // lower = more deterministic JSON
    // Agent only outputs a small JSON object — 512 tokens is ample.
    // Reserving 4096 consumed the entire TPM budget in 2 calls.
    this.maxTokens = config.maxTokens ?? 512;
    this.maxRetries = config.maxRetries ?? 3;

    this.client = axios.create({
      baseURL: config.baseUrl ?? "https://api.groq.com/openai/v1",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60_000,
    });
  }

  async chat(messages: ChatMessage[], maxTokensOverride?: number): Promise<ChatResponse> {
    const hasImages = messages.some(
      (m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url")
    );
    const model = hasImages ? this.visionModel : this.model;
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.post<GroqAPIResponse>(
          "/chat/completions",
          {
            model,
            messages,
            temperature: this.temperature,
            max_tokens: maxTokensOverride ?? this.maxTokens,
          }
        );

        const data = response.data;
        const choice = data.choices[0];

        if (!choice) {
          throw new Error("Groq returned no choices");
        }

        return {
          id: data.id,
          model: data.model,
          content: choice.message.content,
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          },
        };
      } catch (err) {
        lastError = err;

        const isRetryable =
          isAxiosError(err) &&
          err.response !== undefined &&
          RETRYABLE_STATUS_CODES.has(err.response.status);

        if (!isRetryable || attempt >= this.maxRetries) break;

        // On 429 honour the retry window stated by the API instead of guessing.
        let waitMs: number;
        if (isAxiosError(err) && err.response?.status === 429) {
          const apiMessage =
            (err.response?.data as { error?: { message?: string } })?.error?.message ?? "";
          waitMs = parseRetryAfterMs(apiMessage);
          console.error(`  Rate-limited. Waiting ${(waitMs / 1000).toFixed(1)}s before retry ${attempt + 1}/${this.maxRetries}…`);
        } else {
          waitMs = 500 * attempt; // exponential backoff for 5xx
        }

        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    if (isAxiosError(lastError)) {
      const status = lastError.response?.status;
      const message =
        (lastError.response?.data as { error?: { message?: string } })?.error
          ?.message ?? lastError.message;
      throw new Error(`Groq API error${status ? ` (${status})` : ""}: ${message}`);
    }

    throw lastError;
  }

  static fromEnv(): GroqService {
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }

    return new GroqService({
      apiKey,
      baseUrl: process.env["GROQ_BASE_URL"],
      model: process.env["GROQ_MODEL"],
      temperature: process.env["AGENT_TEMPERATURE"]
        ? parseFloat(process.env["AGENT_TEMPERATURE"])
        : undefined,
    });
  }
}

// Convenience function — reads GROQ_API_KEY from env, returns only the model's text content.
export async function callGroq(
  messages: { role: string; content: string }[]
): Promise<string> {
  const service = GroqService.fromEnv();
  const response = await service.chat(messages as ChatMessage[]);
  return response.content;
}
