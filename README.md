# whisperqueue-api

[![License: MIT](https://img.shields.io/github/license/WhisperQueue/whisperqueue-api)](LICENSE)
[![Issues](https://img.shields.io/github/issues/WhisperQueue/whisperqueue-api)](https://github.com/WhisperQueue/whisperqueue-api/issues)

Async GPU-accelerated transcription microservice. Submit an audio file URL, get a job ID back immediately, poll for completion, fetch the transcript. Built on [Bun](https://bun.sh), [Hono](https://hono.dev), [Drizzle](https://orm.drizzle.team), and [faster-whisper](https://github.com/SYSTRAN/faster-whisper).

## Features

- **Async job queue** — returns a job ID immediately; never blocks on transcription
- **ETag-based caching** — skips the GPU entirely when the same file has been transcribed before
- **S3/MinIO support** — accepts `s3://bucket/key` and `https://` URLs
- **Timed segments** — every transcript includes word-level timed chunks (useful for subtitles, search, speaker attribution)
- **Single container** — one Docker image, one process, two volumes, no external services

## Requirements

- Docker with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- NVIDIA GPU with CUDA support
- `docker compose` v2

## Quick Start

```bash
git clone https://github.com/WhisperQueue/whisperqueue-api.git
cd whisperqueue-api
cp .env.example .env
# edit .env — set API_KEY and optionally S3 credentials
docker compose up -d
```

The service starts on port `5001` by default (configurable via `PORT` in `.env`).

## Configuration

Copy `.env.example` to `.env`. All env vars are parsed and validated at startup via Zod — the process exits immediately with a clear error if a required var is missing.

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_KEY` | ✓ | — | Bearer token for all authenticated endpoints. Generate: `openssl rand -hex 32` |
| `DATABASE_PATH` | ✓ | — | Path to the SQLite database file. Docker: `/app/data/whisperqueue.db` |
| `HOSTNAME` | | `127.0.0.1` | Interface the HTTP server binds to |
| `PORT` | | `5001` | HTTP server port |
| `CORS_ORIGINS` | | `*` | Comma-separated list of allowed CORS origins |
| `SECURE_HEADERS` | | `true` | Enable security response headers (CSP, etc.) |
| `LOGGER_LEVEL` | | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOGGER_PRETTY_PRINT` | | `false` | Colorised human-readable logs. Set `true` for local dev |
| `WHISPER_MODEL` | | `large-v3` | faster-whisper model: `tiny`, `base`, `small`, `medium`, `large-v3` |
| `WHISPER_DEVICE` | | `cuda` | Inference device: `cuda` or `cpu` |
| `BEAM_SIZE` | | `5` | Beam search width — higher is more accurate but slower |
| `MAX_FILE_SIZE_MB` | | `500` | Maximum audio file size accepted for download |
| `DOWNLOAD_TIMEOUT_SECONDS` | | `120` | Timeout for downloading audio files |
| `S3_ENDPOINT_URL` | | — | S3-compatible endpoint (e.g. `http://minio:9000`). Leave blank for AWS |
| `AWS_ACCESS_KEY_ID` | | — | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | | — | S3 credentials |
| `AWS_REGION` | | `us-east-1` | S3 region |

### How env vars map to `appConfig`

Env vars are transformed into a structured object at startup:

```ts
appConfig.http.hostname        // HOSTNAME
appConfig.http.port            // PORT                   (coerced to number)
appConfig.http.apiKey          // API_KEY

appConfig.cors.origins         // CORS_ORIGINS           (split on "," → string[])

appConfig.security.headers     // SECURE_HEADERS         (coerced to boolean)

appConfig.database.path        // DATABASE_PATH

appConfig.logger.level         // LOGGER_LEVEL
appConfig.logger.pretty        // LOGGER_PRETTY_PRINT    (coerced to boolean)

appConfig.whisper.model        // WHISPER_MODEL
appConfig.whisper.device       // WHISPER_DEVICE
appConfig.whisper.beamSize     // BEAM_SIZE              (coerced to number)

appConfig.download.maxFileSizeMb     // MAX_FILE_SIZE_MB        (coerced to number)
appConfig.download.timeoutSeconds    // DOWNLOAD_TIMEOUT_SECONDS (coerced to number)

appConfig.s3.endpointUrl       // S3_ENDPOINT_URL        (optional)
appConfig.s3.accessKeyId       // AWS_ACCESS_KEY_ID      (optional)
appConfig.s3.secretAccessKey   // AWS_SECRET_ACCESS_KEY  (optional)
appConfig.s3.region            // AWS_REGION
```

Boolean coercion accepts: `true`, `1`, `yes` → `true` · `false`, `0`, `no`, `""` → `false`.

## API

All endpoints except `GET /health` require `Authorization: Bearer <API_KEY>`.

### `POST /transcribe`

Submit a transcription job. Returns immediately — does not wait for completion.

```bash
curl -X POST http://localhost:3000/transcribe \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "s3://my-bucket/audio/interview.mp3"}'
```

**Response — new job:**
```json
{ "job_id": "job_abc123", "status": "queued", "position": 1 }
```

**Response — cache hit:**
```json
{ "transcript_id": "tr_xyz789", "cached": true }
```

Add `?force=true` to bypass the cache.

### `GET /status/:job_id`

```bash
curl http://localhost:3000/status/job_abc123 \
  -H "Authorization: Bearer $API_KEY"
```

Returns `queued`, `processing` (with `progress` 0–100), `completed` (with `transcript_id`), or `failed` (with `error`).

### `GET /transcript/:transcript_id`

```bash
curl http://localhost:3000/transcript/tr_xyz789 \
  -H "Authorization: Bearer $API_KEY"
```

Returns `425 Too Early` if the job is not finished. Returns the full transcript text, language, duration, and timed segments on success.

### `GET /health`

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "model": "large-v3",
  "device": "cuda",
  "queue_depth": 0,
  "backend": {
    "cli_available": true,
    "cuda_available": true,
    "model_present": true,
    "model_path": "/app/models/large-v3"
  }
}
```

`cuda_available` is `null` when `WHISPER_DEVICE=cpu` (check is skipped).

## Backend check

At startup, before the HTTP server binds, the service verifies three things:

| Check | What it does |
|---|---|
| `cli_available` | Runs `faster-whisper --version` — confirms the CLI is on PATH |
| `cuda_available` | Runs `nvidia-smi` — confirms GPU + CUDA driver (skipped for `cpu` device) |
| `model_present` | Checks `$WHISPER_MODEL` directory exists under `/app/models` |

If any check fails the process exits immediately with a structured error log — the HTTP server never starts. This prevents jobs from being silently queued against a broken backend.

**Diagnosing a startup failure:**

```json
{"level":50,"cliAvailable":false,"cudaAvailable":null,"modelPresent":true,
 "modelPath":"/app/models/large-v3","msg":"Whisper backend check failed — aborting startup"}
```

Common causes:

- `cli_available: false` — `faster-whisper` not installed in the image or not on PATH
- `cuda_available: false` — NVIDIA driver not loaded; check `nvidia-smi` on the host and verify the NVIDIA Container Toolkit is configured
- `model_present: false` — model weights not downloaded or the `whisper-models` volume is not mounted; download weights to the host volume before starting

## Development

Requires [Bun](https://bun.sh) >= 1.2.

```bash
bun install
bun dev             # start with hot reload
bun test            # run tests
bun check           # type check + code analysis
bun db:generate     # generate a new migration from schema changes
bun db:migrate      # apply pending migrations
bun check-backend   # verify faster-whisper CLI, CUDA, and model weights
```

Git hooks are installed automatically via `lefthook` on `bun install`. They run Biome (lint + format) on staged files and `tsc` on each commit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and pull requests are welcome.

## License

[MIT](LICENSE)
