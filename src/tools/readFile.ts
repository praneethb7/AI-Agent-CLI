import path from "node:path";
import fs from "fs-extra";
import { type Tool, type ToolInput, type ToolResult } from "./registry.js";
import { logger } from "../utils/logger.js";

interface ReadFileInput {
  path: string;
}

function isReadFileInput(input: unknown): input is ReadFileInput {
  if (typeof input !== "object" || input === null) return false;
  const i = input as Record<string, unknown>;
  return typeof i["path"] === "string";
}

export const readFileTool: Tool = {
  name: "readFile",
  description: "Read the contents of a file from disk.",
  inputSchema: {
    path: {
      type: "string",
      description: "Path to the file to read (relative to output dir or absolute).",
      required: true,
    },
  },

  async execute(raw: ToolInput): Promise<ToolResult> {
    if (!isReadFileInput(raw)) {
      return { success: false, error: "Missing required field: path" };
    }

    const resolved = path.resolve(
      process.env["OUTPUT_DIR"] ?? "./output",
      raw.path
    );

    logger.debug(`readFile: reading ${resolved}`);

    if (!(await fs.pathExists(resolved))) {
      logger.warn(`readFile: file not found — ${resolved}`);
      return { success: false, error: `File not found: ${resolved}` };
    }

    const content = await fs.readFile(resolved, "utf-8");
    logger.success(`readFile: read ${content.length} bytes from ${resolved}`);

    return { success: true, result: content };
  },
};
