import chalk from "chalk";
import { type ChatMessage, type GroqService } from "../services/groq.js";
import { type ToolRegistry } from "../tools/registry.js";
import { AgentMemory, type MemoryOptions } from "./memory.js";
import { Planner } from "./planner.js";
import { logger } from "../utils/logger.js";

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
  async runAgent(userInput: string): Promise<AgentLoopResult> {
    this.steps = [];
    this.createdFiles = [];
    this.lastResult = null;

    const messages: ChatMessage[] = [
      { role: "system", content: this.buildStructuredSystemPrompt() },
      { role: "user", content: userInput },
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
      messages.push({ role: "user", content: `Observation: ${observation}` });
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

  private async executeWithRetry(
    action: string,
    args: Record<string, unknown>,
    _raw: string,
    _messages: ChatMessage[]
  ): Promise<string> {
    let observation = "";
    let succeeded = false;

    for (let attempt = 1; attempt <= MAX_TOOL_RETRIES + 1; attempt++) {
      try {
        const result = await this.registry.execute(action, args);
        if (result.success) {
          observation = result.result ?? "success";
          succeeded = true;
          if (action === "writeFile" && typeof args["filePath"] === "string") {
            this.createdFiles.push(args["filePath"]);
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

  private buildStructuredSystemPrompt(): string {
    const tools = this.registry.describe();
    const toolList = tools.map((t) => `  - "${t.name}": ${t.description}`).join("\n");
    const toolNames = [...tools.map((t) => t.name), "finish"].join(" | ");

    return [
      "You are a capable AI agent. Complete the user's task step by step.",
      "",
      "Every reply MUST be a single JSON object — no prose, no markdown, just JSON:",
      '{"thought": "<your reasoning>", "action": "<tool or finish>", "args": {<tool args>}, "message": "<only when action=finish>"}',
      "",
      `"action" must be one of: ${toolNames}`,
      'Use action="finish" only after you have taken at least one real action. Include a "message" summarizing what was done.',
      "",
      "Available tools:",
      toolList,
    ]
      .filter(Boolean)
      .join("\n");
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
    return [
      "You are a capable AI agent. Think step by step to complete user tasks.",
      "",
      this.planner.buildToolManifest(),
      "",
      "When the task is complete, say 'Task complete.' without calling any more tools.",
    ]
      .filter(Boolean)
      .join("\n");
  }
}
