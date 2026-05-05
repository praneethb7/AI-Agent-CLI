import { type ChatMessage } from "../services/groq.js";

export interface MemoryOptions {
  systemPrompt?: string | undefined;
  maxMessages?: number | undefined;
}

/**
 * Manages the conversation window passed to the LLM.
 * Applies a sliding-window eviction strategy when the buffer exceeds maxMessages.
 */
export class AgentMemory {
  private readonly messages: ChatMessage[] = [];
  private readonly systemPrompt: string;
  private readonly maxMessages: number;

  constructor(options: MemoryOptions = {}) {
    this.systemPrompt =
      options.systemPrompt ??
      "You are a helpful AI agent that can use tools to complete tasks.";
    this.maxMessages = options.maxMessages ?? 50;
  }

  addUserMessage(content: string): void {
    this.push({ role: "user", content });
  }

  addAssistantMessage(content: string): void {
    this.push({ role: "assistant", content });
  }

  /** Returns the full message list including the system prompt as the first entry. */
  getHistory(): ChatMessage[] {
    return [{ role: "system", content: this.systemPrompt }, ...this.messages];
  }

  /** Returns only the conversation turns (no system prompt). */
  getTurns(): ChatMessage[] {
    return [...this.messages];
  }

  get length(): number {
    return this.messages.length;
  }

  clear(): void {
    this.messages.length = 0;
  }

  private push(message: ChatMessage): void {
    this.messages.push(message);
    this.evict();
  }

  /**
   * Keeps the most recent messages within the window.
   * Always preserves pairs (user + assistant) to avoid orphaned turns.
   */
  private evict(): void {
    while (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }
}
