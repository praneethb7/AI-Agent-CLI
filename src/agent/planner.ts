import { callGroq, type ChatMessage } from "../services/groq.js";
import { type ToolRegistry } from "../tools/registry.js";
import { parseToolCalls, type ToolCall } from "../utils/parser.js";

export interface Plan {
  thought: string;
  toolCalls: ToolCall[];
  isDone: boolean;
}

export interface PlannerContext {
  userInput: string;
  previousSteps: Array<{
    iteration: number;
    thought: string;
    action: string;
    args: Record<string, unknown>;
    observation: string;
  }>;
  filesCreated: string[];
  lastToolResult: string | null;
}

export interface NextStep {
  thought: string;
  action: string;
  input: Record<string, unknown>;
}

const DONE_SIGNALS = ["task complete", "done.", "finished.", "no further steps"];

const SYSTEM_PROMPT = `AI agent. One action at a time. Output strict JSON only:
{"thought":"…","action":"…","input":{…}}
Actions: generate_html|generate_css|generate_js|write_file|read_file|edit_file|list_files|run_command|finish
No markdown. No extra text.`;

/**
 * Interprets the raw LLM response and decides what to do next.
 * Stateless — call once per agent loop iteration.
 */
export class Planner {
  constructor(private readonly registry: ToolRegistry) {}

  parse(response: string): Plan {
    const toolCalls = parseToolCalls(response);
    const isDone = this.detectCompletion(response, toolCalls);
    const thought = this.extractThought(response);

    return { thought, toolCalls, isDone };
  }

  /**
   * Core planning method: given full agent context, asks Groq what to do next.
   * Returns the raw model output (strict JSON string).
   */
  async getNextStep(context: PlannerContext): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildContextMessage(context) },
    ];

    return callGroq(messages as Array<{ role: string; content: string }>);
  }

  /**
   * Builds the tool-use section of the system prompt based on registered tools.
   */
  buildToolManifest(): string {
    const tools = this.registry.describe();

    if (tools.length === 0) return "";

    const list = tools
      .map((t) => `  - **${t.name}**: ${t.description}`)
      .join("\n");

    return [
      "## Available Tools",
      "",
      "To call a tool, wrap a JSON object in a ```tool block:",
      "```tool",
      '{"name": "<tool_name>", "args": {"key": "value"}}',
      "```",
      "",
      "Tools:",
      list,
    ].join("\n");
  }

  private detectCompletion(response: string, toolCalls: ToolCall[]): boolean {
    if (toolCalls.length > 0) return false;
    const lower = response.toLowerCase();
    return DONE_SIGNALS.some((signal) => lower.includes(signal));
  }

  private extractThought(response: string): string {
    return response.replace(/```tool[\s\S]*?```/g, "").trim();
  }
}

/**
 * Standalone convenience function — no registry required.
 * Builds context, calls Groq, and returns the raw JSON string.
 */
export async function getNextStep(context: PlannerContext): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildContextMessage(context) },
  ];

  return callGroq(messages);
}

function buildContextMessage(context: PlannerContext): string {
  const parts: string[] = [`Task: ${context.userInput}`];

  if (context.previousSteps.length > 0) {
    // Only keep the last 3 steps and trim observations to avoid token blowup.
    const recent = context.previousSteps.slice(-3);
    const stepLines = recent.map((s) => {
      const obs = s.observation.length > 80 ? s.observation.slice(0, 77) + "…" : s.observation;
      return `  [${s.action}] → ${obs}`;
    });
    parts.push(`Done:\n${stepLines.join("\n")}`);
  }

  if (context.filesCreated.length > 0) {
    parts.push(`Created: ${context.filesCreated.join(", ")}`);
  }

  if (context.lastToolResult !== null) {
    const r = context.lastToolResult;
    parts.push(`Last: ${r.length > 80 ? r.slice(0, 77) + "…" : r}`);
  }

  parts.push("Next action?");

  return parts.join("\n");
}
