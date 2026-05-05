import path from "node:path";
import fs from "fs-extra";
import { type Tool, type ToolInput, type ToolResult } from "./registry.js";
import { logger } from "../utils/logger.js";

interface ListFilesInput {
  directory: string;
}

function isListFilesInput(input: unknown): input is ListFilesInput {
  if (typeof input !== "object" || input === null) return false;
  const i = input as Record<string, unknown>;
  return typeof i["directory"] === "string";
}

export const listFilesTool: Tool = {
  name: "listFiles",
  description: "List all files and directories inside a given directory.",
  inputSchema: {
    directory: {
      type: "string",
      description: "Directory path to list (relative to output dir or absolute).",
      required: true,
    },
  },

  async execute(raw: ToolInput): Promise<ToolResult> {
    if (!isListFilesInput(raw)) {
      return { success: false, error: "Missing required field: directory" };
    }

    const resolved = path.resolve(
      process.env["OUTPUT_DIR"] ?? "./output",
      raw.directory
    );

    logger.debug(`listFiles: listing ${resolved}`);

    if (!(await fs.pathExists(resolved))) {
      logger.warn(`listFiles: directory not found — ${resolved}`);
      return { success: false, error: `Directory not found: ${resolved}` };
    }

    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      return { success: false, error: `Path is not a directory: ${resolved}` };
    }

    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));

    logger.success(`listFiles: found ${lines.length} entries in ${resolved}`);

    return { success: true, result: lines.join("\n") };
  },
};
