# AI Agent CLI

A production-grade AI agent CLI powered by [Groq](https://groq.com/). Give it a task in plain English and it autonomously plans, executes tools, and produces results — including full websites from a screenshot.

## Features

- **Agentic loop** — structured JSON action planning with loop detection, tool retries, and a premature-finish guard
- **Image-to-website** — pass a screenshot alongside your prompt; the agent analyzes layout, colors, typography, and page copy, then generates matching HTML/CSS/JS
- **Tool registry** — extensible set of built-in tools the agent can invoke
- **Rate-limit handling** — honours Groq's `try again in Xs` window and backs off automatically
- **Interactive REPL** — colored terminal UI with spinner feedback

## Tools

| Tool | Description |
|---|---|
| `writeFile` | Write arbitrary content to a file |
| `readFile` | Read a file's contents |
| `editFile` | Patch a specific section of an existing file |
| `listFiles` | List files in a directory |
| `generateHTML` | Generate a semantic HTML page |
| `generateCSS` | Generate a CSS stylesheet |
| `generateJS` | Generate a JavaScript file |
| `runCommand` | Execute a shell command |

## Requirements

- Node.js ≥ 18
- A [Groq API key](https://console.groq.com/keys)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
npm run build
```

## Usage

### Interactive chat

```bash
npm start chat
# or after build:
node dist/index.js chat
```

**Commands inside the REPL:**

| Input | Action |
|---|---|
| Any text | Send a task to the agent |
| `./path/to/image.png` (inline) | Attach an image for visual analysis |
| `clear` | Clear the screen |
| `exit` | Quit |

### Options

```
agent chat [options]

  -i, --max-iterations <number>   Max agent loop iterations per message (default: 10)
```

### Example prompts

```
You > Build a landing page for a SaaS product called "Scaler"
You > Create a dark-themed portfolio site ./scaler.png
You > List the files in the output directory
```

When an image path is included, the agent first calls the vision model to extract layout, color palette, typography, and all visible text — then uses those exact values when generating HTML and CSS.

## Configuration

All settings live in `.env`:

```env
GROQ_API_KEY=your_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1   # optional override
GROQ_MODEL=llama-3.3-70b-versatile             # text model
AGENT_MAX_ITERATIONS=10
AGENT_TEMPERATURE=0.7
OUTPUT_DIR=./output
LOG_LEVEL=info
```

The vision model (`meta-llama/llama-4-scout-17b-16e-instruct`) is used automatically when the prompt includes an image; no separate config needed.

## Development

```bash
npm run dev        # run from source with ts-node
npm run typecheck  # type-check without emitting
npm run build      # compile to dist/
npm run clean      # remove dist/
```

## Project Structure

```
src/
  agent/
    loop.ts          # agentic action loop + loop detection + retry logic
    memory.ts        # rolling conversation history
    planner.ts       # legacy plan parser
  cli/
    chat.ts          # REPL and image-path extraction
  services/
    groq.ts          # Groq API client with retry / rate-limit handling
  tools/
    registry.ts      # ToolRegistry — register, validate, execute
    generateHTML.ts  # HTML generation tool
    generateCSS.ts   # CSS generation tool
    generateJS.ts    # JS generation tool
    writeFile.ts     # file write tool
    readFile.ts      # file read tool
    editFile.ts      # file patch tool
    listFiles.ts     # directory listing tool
    runCommand.ts    # shell command tool
  utils/
    imageProcessor.ts  # vision analysis → ImageLayout extraction
    logger.ts
    parser.ts
  index.ts           # CLI entry point (commander)
```

## License

MIT
