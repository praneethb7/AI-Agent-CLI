import chalk from "chalk";

export type LogLevel = "info" | "warn" | "error" | "success" | "debug";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  success: 1,
};

function getConfiguredLevel(): LogLevel {
  const env = process.env["LOG_LEVEL"] ?? "info";
  const valid: LogLevel[] = ["debug", "info", "warn", "error", "success"];
  return valid.includes(env as LogLevel) ? (env as LogLevel) : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getConfiguredLevel()];
}

function timestamp(): string {
  return chalk.dim(new Date().toISOString());
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    if (!shouldLog("info")) return;
    console.log(`${timestamp()} ${chalk.cyan("INFO")}  ${message}`, ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    if (!shouldLog("warn")) return;
    console.warn(`${timestamp()} ${chalk.yellow("WARN")}  ${message}`, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    if (!shouldLog("error")) return;
    console.error(`${timestamp()} ${chalk.red("ERROR")} ${message}`, ...args);
  },

  success(message: string, ...args: unknown[]): void {
    if (!shouldLog("success")) return;
    console.log(`${timestamp()} ${chalk.green("OK")}    ${message}`, ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    if (!shouldLog("debug")) return;
    console.log(`${timestamp()} ${chalk.magenta("DEBUG")} ${message}`, ...args);
  },

  /** Print a plain line without any prefix — useful for formatted output. */
  raw(message: string): void {
    console.log(message);
  },
};
