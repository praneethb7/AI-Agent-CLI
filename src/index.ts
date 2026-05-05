#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { runChat } from "./cli/chat.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("agent")
  .description("Production-grade AI agent CLI powered by Groq")
  .version("1.0.0");

program
  .command("chat")
  .description("Start an interactive chat session with the AI agent")
  .option(
    "-i, --max-iterations <number>",
    "Maximum agent loop iterations per message",
    (v) => parseInt(v, 10),
    10
  )
  .action(async (options: { maxIterations: number }) => {
    await runChat({ maxIterations: options.maxIterations });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(message);
  process.exit(1);
});
