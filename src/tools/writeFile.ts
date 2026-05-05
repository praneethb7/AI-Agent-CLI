import path from "node:path";
import fs from "fs-extra";
import { type Tool, type ToolInput, type ToolResult } from "./registry.js";

interface WriteFileInput {
  filePath: string;
  content: string;
  overwrite?: boolean;
}

function isWriteFileInput(input: unknown): input is WriteFileInput {
  if (typeof input !== "object" || input === null) return false;
  const i = input as Record<string, unknown>;
  return typeof i["filePath"] === "string" && typeof i["content"] === "string";
}

export const writeFileTool: Tool = {
  name: "writeFile",
  description: "Write content to a file on disk, creating directories as needed.",
  inputSchema: {
    filePath: {
      type: "string",
      description: "Destination file path (relative to output dir or absolute).",
      required: true,
    },
    content: {
      type: "string",
      description: "The content to write into the file.",
      required: true,
    },
    overwrite: {
      type: "boolean",
      description: "Whether to overwrite an existing file. Defaults to true.",
    },
  },

  async execute(raw: ToolInput): Promise<ToolResult> {
    if (!isWriteFileInput(raw)) {
      return { success: false, error: "Missing required fields: filePath, content" };
    }

    const input = raw as WriteFileInput;
    const resolved = path.resolve(
      process.env["OUTPUT_DIR"] ?? "./output",
      input.filePath
    );

    if (input.overwrite === false && (await fs.pathExists(resolved))) {
      return { success: false, error: `File already exists: ${resolved}` };
    }

    await fs.ensureDir(path.dirname(resolved));
    await fs.writeFile(resolved, input.content, "utf-8");

    return {
      success: true,
      result: `Written ${input.content.length} bytes to ${resolved}`,
    };
  },
};
