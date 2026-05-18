# whisperqueue-api — AI Assistant Context

## Runtime & Tooling

- Runtime: **Bun** — use `bun` everywhere, never `node`, `npm`, `npx`, `ts-node`
- Use `bun test` for tests, not jest or vitest
- Bun auto-loads `.env` — never import or configure `dotenv`

## Framework Conventions

- HTTP framework is **Hono** — never use `Bun.serve()` directly, never use express
- ORM is **Drizzle** over `bun:sqlite` — never write raw SQL or use `bun:sqlite` directly
- Job queue is **bunqueue** (SQLite-backed) — no Redis, no BullMQ, no external queue
- No frontend — this is a pure API server, no HTML, no React, no Vite

## Path Aliases

Use `@/*` for all internal imports — maps to `./src/*`.

```ts
import { db } from '@/db/client';
import { transcriptions } from '@/db/schema';
```

## TypeScript Rules

- **Never use `any`** — create proper types or use `unknown`
- All Hono route handlers must have typed request/response
- Zod v4: use `z.url()` not `z.string().url()`
- Never use `private` in classes — use `protected`
- Catch clauses that only rethrow are useless — remove them

## Before Declaring Done

Run `bun check` and fix **all** issues — zero errors, zero warnings required.

## Project Structure

```
src/
├── index.ts          # entrypoint — startWorker() + startServer()
├── server.ts         # Hono app + route registration
├── worker.ts         # bunqueue job processor
├── db/
│   ├── client.ts     # Drizzle + bun:sqlite instance
│   └── schema.ts     # transcriptions table
├── routes/
│   ├── transcribe.ts # POST /transcribe
│   ├── status.ts     # GET /status/:job_id
│   ├── transcript.ts # GET /transcript/:transcript_id
│   └── health.ts     # GET /health (no auth)
├── services/
│   ├── cache.ts      # ETag lookup + hash check
│   ├── downloader.ts # S3 + HTTPS download
│   └── transcriber.ts# Bun.spawn() → faster-whisper CLI
└── middleware/
    └── auth.ts       # Bearer token validation
```

## Key Behaviors

- Auth: all routes except `GET /health` require `Authorization: Bearer <API_KEY>`
- Cache: HEAD request to get ETag before any download; cache hit skips job queue entirely
- One job at a time (GPU constraint — concurrent jobs saturate VRAM)
- `?force=true` on `/transcribe` bypasses the cache
- faster-whisper streams segments — collect all before marking job complete
- SQLite file: `/app/data/whisperqueue.db` (Docker volume)
- Model weights: `/app/models` (Docker volume)
