import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import ora from "ora";
import { AgentLoop, type AgentLoopOptions } from "../agent/loop.js";
import { GroqService } from "../services/groq.js";
import { registry } from "../tools/registry.js";

import { writeFileTool } from "../tools/writeFile.js";
import { generateHTMLTool } from "../tools/generateHTML.js";
import { generateCSSTool } from "../tools/generateCSS.js";
import { generateJSTool } from "../tools/generateJS.js";
import { readFileTool } from "../tools/readFile.js";
import { listFilesTool } from "../tools/listFiles.js";
import { editFileTool } from "../tools/editFile.js";
import { runCommandTool } from "../tools/runCommand.js";

registry
  .register(writeFileTool)
  .register(generateHTMLTool)
  .register(generateCSSTool)
  .register(generateJSTool)
  .register(readFileTool)
  .register(listFilesTool)
  .register(editFileTool)
  .register(runCommandTool);

export interface ChatCommandOptions {
  maxIterations?: number | undefined;
}

function printBanner(): void {
  console.log(chalk.cyan("┌─────────────────────────────────┐"));
  console.log(chalk.cyan("│") + chalk.bold.white("        AI Agent CLI             ") + chalk.cyan("│"));
  console.log(chalk.cyan("└─────────────────────────────────┘"));
  console.log(chalk.dim('  "exit" to quit  •  "clear" to clear screen\n'));
}

export async function runChat(options: ChatCommandOptions = {}): Promise<void> {
  const groq = GroqService.fromEnv();

  const loopOptions: AgentLoopOptions = {
    ...(options.maxIterations !== undefined ? { maxIterations: options.maxIterations } : {}),
  };

  const agent = new AgentLoop(groq, registry, loopOptions);
  const rl = readline.createInterface({ input, output });

  console.clear();
  printBanner();

  try {
    while (true) {
      const userInput = await rl.question(chalk.green.bold("You > "));
      const trimmed = userInput.trim();

      if (!trimmed) continue;

      if (trimmed.toLowerCase() === "exit") break;

      if (trimmed.toLowerCase() === "clear") {
        console.clear();
        printBanner();
        continue;
      }

      const spinner = ora({ text: chalk.dim("Thinking…"), color: "cyan" }).start();

      try {
        const result = await agent.run(trimmed);
        spinner.stop();

        process.stdout.write("\n");
        console.log(chalk.blue.bold("Agent > ") + result.finalResponse);
        console.log(chalk.dim(`\n  [${result.iterations} iteration(s)]`));
        process.stdout.write("\n");
      } catch (err) {
        spinner.fail(chalk.red("Agent error"));
        const message = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`  ${message}`));
        process.stdout.write("\n");
      }
    }
  } finally {
    rl.close();
    console.log(chalk.dim("\nGoodbye.\n"));
  }
}
