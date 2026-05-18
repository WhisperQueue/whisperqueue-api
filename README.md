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

The service starts on port `3000` (configurable via `.env`).

## Configuration

Copy `.env.example` to `.env` and set the following:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `API_KEY` | — | Bearer token for auth. Generate: `openssl rand -hex 32` |
| `WHISPER_MODEL` | `large-v3` | Model size: `tiny`, `base`, `small`, `medium`, `large-v3` |
| `BEAM_SIZE` | `5` | Beam search width (higher = more accurate, slower) |
| `MAX_FILE_SIZE_MB` | `500` | Max audio file size |
| `DOWNLOAD_TIMEOUT_SECONDS` | `120` | Timeout for downloading audio files |
| `S3_ENDPOINT_URL` | — | S3-compatible endpoint (e.g. `http://minio:9000`). Leave blank for AWS |
| `AWS_ACCESS_KEY_ID` | — | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | — | S3 credentials |
| `AWS_REGION` | `us-east-1` | S3 region |

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
{ "status": "ok", "model": "large-v3", "device": "cuda", "queue_depth": 0 }
```

## Development

Requires [Bun](https://bun.sh) >= 1.2.

```bash
bun install
bun dev          # start with hot reload
bun test         # run tests
bun check        # type check + code analysis
```

Git hooks are installed automatically via `lefthook` on `bun install`. They run Biome (lint + format) on staged files and `tsc` on each commit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and pull requests are welcome.

## License

[MIT](LICENSE)
