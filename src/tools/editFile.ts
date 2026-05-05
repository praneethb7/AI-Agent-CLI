import path from "node:path";
import fs from "fs-extra";
import { type Tool, type ToolInput, type ToolResult } from "./registry.js";
import { logger } from "../utils/logger.js";

interface ReplaceChange {
  type: "replace";
  from: string;
  to: string;
}

interface AppendChange {
  type: "append";
  content: string;
}

type FileChange = ReplaceChange | AppendChange;

interface EditFileInput {
  path: string;
  changes: FileChange[];
}

function isFileChange(c: unknown): c is FileChange {
  if (typeof c !== "object" || c === null) return false;
  const change = c as Record<string, unknown>;
  if (change["type"] === "replace") {
    return typeof change["from"] === "string" && typeof change["to"] === "string";
  }
  if (change["type"] === "append") {
    return typeof change["content"] === "string";
  }
  return false;
}

function isEditFileInput(input: unknown): input is EditFileInput {
  if (typeof input !== "object" || input === null) return false;
  const i = input as Record<string, unknown>;
  return (
    typeof i["path"] === "string" &&
    Array.isArray(i["changes"]) &&
    (i["changes"] as unknown[]).every(isFileChange)
  );
}

export const editFileTool: Tool = {
  name: "editFile",
  description:
    "Read a file, apply a list of replace or append changes, then save it back.",
  inputSchema: {
    path: {
      type: "string",
      description: "Path to the file to edit (relative to output dir or absolute).",
      required: true,
    },
    changes: {
      type: "array",
      description:
        'Array of change objects. Each must have "type": "replace" (with "from"/"to") or "type": "append" (with "content").',
      required: true,
    },
  },

  async execute(raw: ToolInput): Promise<ToolResult> {
    if (!isEditFileInput(raw)) {
      return {
        success: false,
        error:
          'Missing or invalid fields. Provide path (string) and changes (array of {type:"replace",from,to} or {type:"append",content}).',
      };
    }

    const resolved = path.resolve(
      process.env["OUTPUT_DIR"] ?? "./output",
      raw.path
    );

    logger.debug(`editFile: editing ${resolved}`);

    if (!(await fs.pathExists(resolved))) {
      logger.warn(`editFile: file not found — ${resolved}`);
      return { success: false, error: `File not found: ${resolved}` };
    }

    let content = await fs.readFile(resolved, "utf-8");

    for (const change of raw.changes) {
      if (change.type === "replace") {
        if (!content.includes(change.from)) {
          logger.warn(`editFile: replace target not found in file — "${change.from}"`);
          return {
            success: false,
            error: `Replace target not found in file: "${change.from}"`,
          };
        }
        content = content.split(change.from).join(change.to);
        logger.debug(`editFile: replaced "${change.from}" → "${change.to}"`);
      } else {
        content += change.content;
        logger.debug(`editFile: appended ${change.content.length} chars`);
      }
    }

    await fs.writeFile(resolved, content, "utf-8");
    logger.success(`editFile: saved ${content.length} bytes to ${resolved}`);

    return {
      success: true,
      result: `Applied ${raw.changes.length} change(s) to ${resolved}`,
    };
  },
};
