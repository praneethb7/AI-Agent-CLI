import axios, { type AxiosInstance, isAxiosError } from "axios";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

export class GroqService {
  private readonly client: AxiosInstance;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly maxRetries: number;

  constructor(config: GroqClientConfig) {
    this.model = config.model ?? "llama-3.3-70b-versatile";
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.maxRetries = config.maxRetries ?? 2;

    this.client = axios.create({
      baseURL: config.baseUrl ?? "https://api.groq.com/openai/v1",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.post<GroqAPIResponse>(
          "/chat/completions",
          {
            model: this.model,
            messages,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
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

        const shouldRetry =
          attempt < this.maxRetries &&
          isAxiosError(err) &&
          err.response !== undefined &&
          RETRYABLE_STATUS_CODES.has(err.response.status);

        if (!shouldRetry) break;

        // Exponential backoff: 500ms, 1000ms, ...
        await new Promise((r) => setTimeout(r, 500 * attempt));
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
