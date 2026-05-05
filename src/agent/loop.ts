import { readFileSync } from "node:fs";
import { extname } from "node:path";
import chalk from "chalk";
import { type ChatMessage, type ContentPart, type GroqService } from "../services/groq.js";
import { type ToolRegistry } from "../tools/registry.js";
import { AgentMemory, type MemoryOptions } from "./memory.js";
import { Planner } from "./planner.js";
import { logger } from "../utils/logger.js";
import { analyzeImageLayout, type ImageLayout } from "../utils/imageProcessor.js";

export interface AgentLoopOptions extends MemoryOptions {
  maxIterations?: number | undefined;
}

export interface AgentLoopResult {
  iterations: number;
  finalResponse: string;
}

export interface AgentStep {
  iteration: number;
  thought: string;
  action: string;
  args: Record<string, unknown>;
  observation: string;
}

const MAX_AGENT_ITERATIONS = 6;
const MAX_TOOL_RETRIES = 2;
const LOOP_DETECTION_WINDOW = 3;

export class AgentLoop {
  private readonly groq: GroqService;
  private readonly registry: ToolRegistry;
  private readonly planner: Planner;
  private readonly memory: AgentMemory;
  private readonly maxIterations: number;

  steps: AgentStep[] = [];
  createdFiles: string[] = [];
  lastResult: string | null = null;
  private imageAnalysis?: ImageLayout;

  constructor(
    groq: GroqService,
    registry: ToolRegistry,
    options: AgentLoopOptions = {}
  ) {
    this.groq = groq;
    this.registry = registry;
    this.planner = new Planner(registry);
    this.maxIterations = options.maxIterations ?? 10;
    this.memory = new AgentMemory({
      systemPrompt: this.buildSystemPrompt(),
      ...(options.maxMessages !== undefined ? { maxMessages: options.maxMessages } : {}),
    });
  }

  /**
   * Structured agent loop. Each iteration the LLM returns a JSON action plan;
   * the loop executes the named tool and feeds the observation back until the
   * LLM emits action="finish" or the iteration cap is hit.
   */
  async runAgent(userInput: string, imagePath?: string): Promise<AgentLoopResult> {
    this.steps = [];
    this.createdFiles = [];
    this.lastResult = null;

    // Pre-analyze the image so ALL details can be injected into tool args at execution time
    if (imagePath) {
      logger.raw(chalk.dim("  Analyzing image…\n"));
      this.imageAnalysis = await analyzeImageLayout(imagePath, this.groq);
      const ia = this.imageAnalysis;
      logger.raw(
        chalk.dim(
          `  Detected: layout=${ia.layout}, theme=${ia.theme}, primary=${ia.styleHints.primaryColor}, sections=[${ia.sections.join(",")}]\n`
        )
      );
      if (ia.pageData?.nav?.brandName) {
        logger.raw(chalk.dim(`  Brand: ${ia.pageData.nav.brandName}\n`));
      }
    }
    const imageLayout = this.imageAnalysis;

    const userContent = imagePath
      ? this.buildImageContent(userInput, imagePath)
      : userInput;

    const messages: ChatMessage[] = [
      { role: "system", content: this.buildStructuredSystemPrompt(imageLayout) },
      { role: "user", content: userContent },
    ];

    const recentActions: string[] = [];
    let iterations = 0;
    let finalResponse = "";

    while (iterations < MAX_AGENT_ITERATIONS) {
      iterations++;

      const { content: raw } = await this.groq.chat(messages);

      let plan: {
        thought: string;
        action: string;
        args?: Record<string, unknown>;
        message?: string;
      };

      try {
        plan = JSON.parse(this.extractJSON(raw)) as typeof plan;
      } catch {
        logger.warn(`Iteration ${iterations}: response is not valid JSON — stopping`);
        finalResponse = raw.trim();
        break;
      }

      const { thought, action, args = {}, message } = plan;

      // Loop protection: halt if the same action repeats N times in a row
      recentActions.push(action);
      if (recentActions.length > LOOP_DETECTION_WINDOW) recentActions.shift();
      if (
        recentActions.length === LOOP_DETECTION_WINDOW &&
        recentActions.every((a) => a === action)
      ) {
        logger.warn(
          `Loop detected: "${action}" repeated ${LOOP_DETECTION_WINDOW} times — aborting`
        );
        finalResponse = this.steps.at(-1)?.thought ?? "Stuck in a loop.";
        this.lastResult = finalResponse;
        break;
      }

      this.logStep(iterations, thought, action);

      // Smarter finish: only allow once real work has been done
      if (action === "finish") {
        const taskDone = this.createdFiles.length > 0 || this.steps.length > 0;
        if (!taskDone) {
          logger.raw(chalk.red(`  ✗ Premature finish — no actions taken yet. Nudging agent.\n`));
          messages.push({ role: "assistant", content: raw });
          messages.push({
            role: "user",
            content:
              "You called finish but no work has been done yet. Please take at least one action before finishing.",
          });
          continue;
        }
        finalResponse = message ?? thought;
        this.steps.push({ iteration: iterations, thought, action, args, observation: "done" });
        this.lastResult = finalResponse;
        logger.raw(chalk.green(`\n✓ Done: ${finalResponse}\n`));
        break;
      }

      // Execute tool with retry on failure
      const observation = await this.executeWithRetry(action, args, raw, messages);

      logger.raw(chalk.green(`  Observation: ${observation}\n`));

      this.steps.push({ iteration: iterations, thought, action, args, observation });
      this.lastResult = observation;

      messages.push({ role: "assistant", content: raw });
      // Truncate observations — the agent only needs to know success/failure, not full content.
      const shortObs = observation.length > 120 ? observation.slice(0, 117) + "…" : observation;
      messages.push({ role: "user", content: `Observation: ${shortObs}` });
    }

    if (iterations >= MAX_AGENT_ITERATIONS && !finalResponse) {
      logger.warn(`Agent reached max iterations (${MAX_AGENT_ITERATIONS})`);
      finalResponse = this.steps.at(-1)?.thought ?? "Max iterations reached without finishing.";
      this.lastResult = finalResponse;
    }

    if (this.createdFiles.length > 0) {
      logger.success(`Files created: ${this.createdFiles.join(", ")}`);
    }

    return { iterations, finalResponse };
  }

  async run(userMessage: string): Promise<AgentLoopResult> {
    this.memory.addUserMessage(userMessage);

    let iterations = 0;
    let finalResponse = "";

    while (iterations < this.maxIterations) {
      iterations++;
      logger.debug(`Agent iteration ${iterations}/${this.maxIterations}`);

      const response = await this.groq.chat(this.memory.getHistory());
      const { content } = response;

      this.memory.addAssistantMessage(content);

      const plan = this.planner.parse(content);

      if (plan.isDone || plan.toolCalls.length === 0) {
        finalResponse = plan.thought || content;
        break;
      }

      const toolResults = await this.executeTools(plan.toolCalls);
      this.memory.addUserMessage(toolResults);
    }

    if (iterations >= this.maxIterations) {
      logger.warn(`Agent reached max iterations (${this.maxIterations})`);
    }

    return { iterations, finalResponse };
  }

  private mergeImageAnalysis(action: string, args: Record<string, unknown>): Record<string, unknown> {
    const ia = this.imageAnalysis;
    if (!ia) return args;

    if (action === "generateHTML") {
      return {
        ...args,
        layout: ia.layout,
        theme: ia.theme,
        sections: ia.sections,
        ...(ia.pageData ? { pageData: ia.pageData } : {}),
      };
    }

    if (action === "generateCSS") {
      const existing = (args["styleHints"] as Record<string, unknown>) ?? {};
      return {
        ...args,
        styleHints: {
          ...existing,
          background: ia.styleHints.background,
          typography: ia.typography ?? { scale: ia.styleHints.typography },
          ...(ia.colors ? { colorPalette: ia.colors } : { primaryColor: ia.styleHints.primaryColor }),
        },
      };
    }

    return args;
  }

  private async executeWithRetry(
    action: string,
    args: Record<string, unknown>,
    _raw: string,
    _messages: ChatMessage[]
  ): Promise<string> {
    const mergedArgs = this.mergeImageAnalysis(action, args);
    let observation = "";
    let succeeded = false;

    for (let attempt = 1; attempt <= MAX_TOOL_RETRIES + 1; attempt++) {
      try {
        const result = await this.registry.execute(action, mergedArgs);
        if (result.success) {
          observation = result.result ?? "success";
          succeeded = true;
          if (action === "writeFile" && typeof args["filePath"] === "string") {
            this.createdFiles.push(args["filePath"]);
          } else if (
            ["generateHTML", "generateCSS", "generateJS"].includes(action) &&
            typeof args["filename"] === "string"
          ) {
            this.createdFiles.push(args["filename"]);
          }
          break;
        } else {
          observation = `FAILED: ${result.error ?? "unknown error"}`;
        }
      } catch (err) {
        observation = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
      }

      if (attempt <= MAX_TOOL_RETRIES) {
        logger.raw(
          chalk.red(
            `  ✗ Attempt ${attempt}/${MAX_TOOL_RETRIES + 1} failed: ${observation} — retrying...\n`
          )
        );
      }
    }

    if (!succeeded) {
      logger.raw(chalk.red(`  ✗ Tool "${action}" failed after ${MAX_TOOL_RETRIES + 1} attempts.\n`));
      observation = `${observation} — tried ${MAX_TOOL_RETRIES + 1} times. Try a different approach.`;
    }

    return observation;
  }

  private logStep(iteration: number, thought: string, action: string): void {
    logger.raw(
      chalk.bold.cyan(`\n── Step ${iteration}/${MAX_AGENT_ITERATIONS} ──────────────────────`)
    );
    logger.raw(chalk.cyan(`  Thought:  `) + thought);
    logger.raw(chalk.yellow(`  Action:   `) + action);
  }

  private extractJSON(raw: string): string {
    const jsonBlock = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(raw);
    if (jsonBlock?.[1]) return jsonBlock[1].trim();
    const jsonObject = /\{[\s\S]*\}/.exec(raw);
    if (jsonObject?.[0]) return jsonObject[0];
    return raw.trim();
  }

  private buildImageContent(text: string, imagePath: string): ContentPart[] {
    const ext = extname(imagePath).toLowerCase().slice(1);
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
    };
    const mime = mimeMap[ext] ?? "image/png";
    const base64 = readFileSync(imagePath).toString("base64");
    return [
      { type: "text", text },
      { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
    ];
  }

  private buildStructuredSystemPrompt(imageLayout?: ImageLayout): string {
    const toolNames = [...this.registry.list(), "finish"].join("|");

    const base = [
      "AI agent. Reply ONLY with one JSON object, no prose:",
      '{"thought":"…","action":"…","args":{…},"message":"…(finish only)"}',
      `action ∈ ${toolNames}`,
      "finish only after real work; include message.",
      "Website task order: generateHTML(index.html) → generateCSS(styles.css) → generateJS(script.js) → finish.",
    ];

    if (imageLayout) {
      const { layout, theme, sections, styleHints } = imageLayout;
      // Inject the analyzed values as the exact args the agent must use
      base.push(
        `generateHTML args: ${JSON.stringify({
          filename: "index.html",
          layout,
          theme,
          sections,
        })}`,
        `generateCSS args: ${JSON.stringify({
          filename: "styles.css",
          styleHints: {
            primaryColor: styleHints.primaryColor,
            background: styleHints.background,
            typography: { scale: styleHints.typography },
          },
        })}`,
        'generateJS args: {"filename":"script.js","features":["navbarToggle","smoothScroll","buttonInteraction"]}',
        "Use EXACTLY the layout/theme/styleHints args above — they were extracted from the reference image.",
      );
    } else {
      base.push(
        'generateHTML args: {"filename":"index.html"}',
        'generateCSS args: {"filename":"styles.css"}',
        'generateJS args: {"filename":"script.js","features":["navbarToggle","smoothScroll","buttonInteraction"]}',
      );
    }

    return base.join("\n");
  }

  private async executeTools(
    calls: Array<{ name: string; args: Record<string, unknown> }>
  ): Promise<string> {
    const results: string[] = [];

    for (const call of calls) {
      logger.debug(`Executing tool: ${call.name}`);
      try {
        const result = await this.registry.execute(call.name, call.args);
        results.push(
          `Tool "${call.name}" → ${result.success ? "OK" : "FAILED"}: ${result.result ?? result.error ?? ""}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push(`Tool "${call.name}" → ERROR: ${message}`);
      }
    }

    return results.join("\n");
  }

  private buildSystemPrompt(): string {
    const toolNames = this.registry.list().join("|");
    return `AI agent. Use tools to complete tasks. Tools: ${toolNames}. Say "Task complete." when done.`;
  }
}
