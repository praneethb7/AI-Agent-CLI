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

const SYSTEM_PROMPT = `You are an advanced AI coding agent similar to Cursor.

You can:
- build applications
- generate websites
- read/edit files
- execute commands

You MUST:
- think step by step
- take ONE action at a time
- use tools to complete tasks

Available actions:
- generate_html
- generate_css
- generate_js
- write_file
- read_file
- edit_file
- list_files
- run_command
- finish

Rules:
- Never do everything in one step
- Always break tasks down
- Prefer modifying files over rewriting
- Ensure outputs are practical and runnable

Special rule for website cloning:
If user asks to clone a website (e.g., Scaler Academy):
- First generate HTML structure
- Then CSS
- Then JS
- Then write files

OUTPUT STRICT JSON:
{
  "thought": "...",
  "action": "...",
  "input": {...}
}

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
  const parts: string[] = [`User request: ${context.userInput}`];

  if (context.previousSteps.length > 0) {
    const stepLines = context.previousSteps.map(
      (s) =>
        `  Step ${s.iteration}: [${s.action}] ${s.thought}\n    Observation: ${s.observation}`
    );
    parts.push(`Previous steps:\n${stepLines.join("\n")}`);
  } else {
    parts.push("Previous steps: none");
  }

  if (context.filesCreated.length > 0) {
    parts.push(`Files created so far: ${context.filesCreated.join(", ")}`);
  } else {
    parts.push("Files created so far: none");
  }

  if (context.lastToolResult !== null) {
    parts.push(`Last tool result: ${context.lastToolResult}`);
  } else {
    parts.push("Last tool result: none");
  }

  parts.push("What is the next single action to take?");

  return parts.join("\n\n");
}
