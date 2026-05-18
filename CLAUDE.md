# whisperqueue-api — AI Assistant Context

See root `CLAUDE.md` for shared rules (commits, TypeScript, tooling).

## Framework Conventions

- HTTP framework is **Hono** — never use `Bun.serve()` directly, never use express
- ORM is **Drizzle** over `bun:sqlite` — never write raw SQL or use `bun:sqlite` directly
- Job queue is **bunqueue** (SQLite-backed) — no Redis, no BullMQ, no external queue
- No frontend — pure API server, no HTML, no React, no Vite

## Path Aliases

Use `@/*` for all internal imports — maps to `./src/*`.

```ts
import { db } from '@/db/client';
import { transcriptions } from '@/db/schema';
```

## Zod

Use Zod v4: `z.url()` not `z.string().url()`

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
