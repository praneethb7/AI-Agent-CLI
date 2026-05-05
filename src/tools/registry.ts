export type ToolInput = Record<string, unknown>;

export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, ToolParamSchema>;
  execute(input: ToolInput): Promise<ToolResult>;
}

export interface ToolParamSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getOrThrow(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(
        `Tool "${name}" not found. Available: ${this.list().join(", ")}`
      );
    }
    return tool;
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  describe(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  private validateInput(tool: Tool, input: ToolInput): string | null {
    for (const [key, schema] of Object.entries(tool.inputSchema)) {
      if (schema.required && !(key in input)) {
        return `Missing required parameter: "${key}"`;
      }
      if (key in input && input[key] !== undefined) {
        const actual = Array.isArray(input[key]) ? "array" : typeof input[key];
        if (actual !== schema.type) {
          return `Parameter "${key}" must be of type ${schema.type}, got ${actual}`;
        }
      }
    }
    return null;
  }

  async execute(name: string, input: ToolInput): Promise<ToolResult> {
    let tool: Tool;
    try {
      tool = this.getOrThrow(name);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    const validationError = this.validateInput(tool, input);
    if (validationError) {
      return { success: false, error: validationError };
    }

    try {
      return await tool.execute(input);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const registry = new ToolRegistry();

/**
 * Convenience wrapper used by the agent loop.
 * Delegates to the singleton registry so callers don't need to import it directly.
 */
export async function executeTool(
  action: string,
  input: ToolInput
): Promise<ToolResult> {
  return registry.execute(action, input);
}
