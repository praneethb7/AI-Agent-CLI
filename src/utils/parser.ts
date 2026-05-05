export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface CodeBlock {
  language: string;
  content: string;
}

const TOOL_CALL_REGEX = /```tool\s*\n([\s\S]*?)```/g;
const CODE_BLOCK_REGEX = /```(\w+)?\s*\n([\s\S]*?)```/g;

/**
 * Extracts structured tool calls from LLM output.
 * Expected format: ```tool\n{"name":"...","args":{...}}\n```
 */
export function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;

  TOOL_CALL_REGEX.lastIndex = 0;

  while ((match = TOOL_CALL_REGEX.exec(content)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isToolCall(parsed)) {
        calls.push(parsed);
      }
    } catch {
      // malformed JSON — skip silently
    }
  }

  return calls;
}

/**
 * Extracts all fenced code blocks from content, including their language tag.
 */
export function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;

  CODE_BLOCK_REGEX.lastIndex = 0;

  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    blocks.push({
      language: match[1] ?? "plaintext",
      content: match[2]?.trimEnd() ?? "",
    });
  }

  return blocks;
}

/** Strips markdown formatting from a string. */
export function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .trim();
}

export interface LLMResponse {
  thought: string;
  action: string;
  input: unknown;
}

export class LLMParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "LLMParseError";
  }
}

/**
 * Extracts and repairs JSON from raw LLM output, then validates it as an LLMResponse.
 * Retries up to 3 times with progressively more aggressive fixes before throwing.
 */
export function parseLLMResponse(text: string): LLMResponse {
  const attempts = [
    () => tryParse(text),
    () => tryParse(extractJSON(text)),
    () => tryParse(repairJSON(extractJSON(text))),
  ];

  for (const attempt of attempts) {
    const result = attempt();
    if (result !== null) return result;
  }

  throw new LLMParseError(
    `Failed to parse LLM response after all repair attempts`,
    text,
  );
}

function tryParse(raw: string): LLMResponse | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isLLMResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Pulls the first {...} or [...] block out of surrounding prose.
function extractJSON(text: string): string {
  const start = text.search(/[{[]/);
  if (start === -1) return text;

  const opener = text[start] as "{" | "[";
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;

  for (let i = start; i < text.length; i++) {
    if (text[i] === opener) depth++;
    else if (text[i] === closer) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return text.slice(start);
}

// Fixes the most common LLM JSON mistakes: single quotes, trailing commas, unquoted keys.
function repairJSON(raw: string): string {
  return raw
    .replace(/,\s*([}\]])/g, "$1")           // trailing commas
    .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":') // single-quoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"')     // single-quoted string values
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // unquoted keys
}

function isLLMResponse(value: unknown): value is LLMResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["thought"] === "string" &&
    typeof v["action"] === "string" &&
    "input" in v
  );
}

function isToolCall(value: unknown): value is ToolCall {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as Record<string, unknown>)["name"] === "string" &&
    "args" in value &&
    typeof (value as Record<string, unknown>)["args"] === "object"
  );
}
