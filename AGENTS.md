# AGENTS.md — mcp-telegram

## Overview

MCP server exposing Telegram (MTProto) functionality to AI clients via [FastMCP](https://github.com/punkpeye/fastmcp). CLI built with Commander; two transports: `stdio` (default, for Cursor/Claude) and `sse`.

## Architecture

```
src/index.ts   — CLI entrypoint (Commander): sign-in, mcp, logout commands
src/mcp.ts     — FastMCP server creation, tool registration, transport start
src/config.ts  — Singleton config from env vars / .env
src/lib/       — Telegram client (GramJS), cached singleton via createClient()
src/tools/     — MCP tool definitions (one file per tool)
src/utils/     — Logger (chalk, writes to stderr) and error handler
```

**Data flow:** CLI (`index.ts`) → `mcp.ts` creates FastMCP server → registers tools from `tools/index.ts` → each tool calls `createClient()` from `lib/telegram.ts` to interact with Telegram API.

## Key Conventions

- **ESM everywhere** — `"type": "module"` in package.json; all imports use `.js` extensions even for `.ts` files (`'./config.js'`).
- **Tool pattern** — Each tool is a file in `src/tools/` exporting a `Tool<undefined, ZodSchema>` object with `name`, `description`, `parameters` (Zod schema), and `execute`. Register new tools in `src/tools/index.ts` by adding to the `tools` array.
- **Telegram client** — Singleton cached in `lib/telegram.ts` (`cachedClient`). Always use `createClient()`, never instantiate `TelegramClient` directly. Session stored on disk as `StoreSession('mcp_telegram_session')`.
- **Logger outputs to stderr** — All `logger.*` calls use `console.error` to avoid interfering with stdio MCP transport on stdout.
- **Zod for validation** — Tool parameters defined with Zod; `.describe()` on each field provides MCP parameter descriptions.
- **JSON import** — `package.json` imported with `with { type: 'json' }` assertion syntax.

## Build & Run

```bash
npm run build          # tsc → dist/
npm run start          # node dist/index.js mcp (stdio)
npm run dev            # ts-node src/index.ts
npm run sign-in        # Interactive Telegram auth (phone + code + optional 2FA)
npm run inspect        # FastMCP inspector on src/mcp.ts
```

Requires: Node ≥ 20, env vars `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` (via `.env`).

## Adding a New Tool

1. Create `src/tools/myTool.ts` — define Zod params schema + `Tool` object with `execute`.
2. Use `createClient()` from `../lib/telegram.js` inside execute.
3. Return `JSON.stringify(result)` — tools return stringified JSON.
4. Export and register in `src/tools/index.ts` (add to `tools` array + named export).

Follow `src/tools/listDialogs.ts` as the canonical example.

## Gotchas

- `listMessages.ts` has an unused import of `server` from `mcp.ts` — avoid circular deps when adding tools.
- Dialog/message IDs are `BigInteger` (via `big-integer` lib); convert string IDs with `bigInt(id)`.
- `mcp.ts` auto-starts the server when run directly (bottom of file checks `process.argv[1]`), enabling `fastmcp inspect`.
- Several `@ts-ignore` comments in `mcp.ts` for FastMCP type mismatches — expected, not bugs.

