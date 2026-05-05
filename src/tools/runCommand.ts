import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type Tool, type ToolInput, type ToolResult } from "./registry.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

interface RunCommandInput {
  command: string;
}

function isRunCommandInput(input: unknown): input is RunCommandInput {
  if (typeof input !== "object" || input === null) return false;
  const i = input as Record<string, unknown>;
  return typeof i["command"] === "string" && i["command"].trim() !== "";
}

export const runCommandTool: Tool = {
  name: "runCommand",
  description: "Execute a shell command and return its stdout and stderr.",
  inputSchema: {
    command: {
      type: "string",
      description: "The shell command to run (passed to /bin/sh -c).",
      required: true,
    },
  },

  async execute(raw: ToolInput): Promise<ToolResult> {
    if (!isRunCommandInput(raw)) {
      return { success: false, error: "Missing required field: command" };
    }

    logger.debug(`runCommand: ${raw.command}`);

    try {
      const { stdout, stderr } = await execFileAsync("/bin/sh", ["-c", raw.command], {
        timeout: 30_000,
      });

      const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
      logger.success(`runCommand: exited 0 — ${raw.command}`);

      return { success: true, result: combined || "(no output)" };
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
      const combined = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
      logger.error(`runCommand: failed — ${raw.command}`, e.message);

      return {
        success: false,
        error: `Command failed (exit ${e.code ?? "?"}):\n${combined || e.message}`,
      };
    }
  },
};
