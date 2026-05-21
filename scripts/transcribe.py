#!/usr/bin/env python3
"""Wrapper around faster_whisper that outputs JSON-lines to stdout.

Emits one JSON object per line:
  {"type":"info","language":"en","language_probability":0.98,"duration":120.5}
  {"type":"segment","start":0.0,"end":5.2,"text":"Hello world"}
  {"type":"done"}

Use --check to validate the installation without transcribing.
"""

import argparse
import json
import sys
from pathlib import Path


def check_installation(model: str, model_dir: str) -> None:
    """Validate faster_whisper is importable and model dir exists."""
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        print("faster_whisper is not installed", file=sys.stderr)
        sys.exit(1)

    if not Path(model_dir).joinpath(model).exists():
        print(f"model not found at {model_dir}/{model}", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)


def transcribe(
    file_path: str,
    model: str,
    model_dir: str,
    device: str,
    beam_size: int,
    language: str | None,
) -> None:
    from faster_whisper import WhisperModel

    whisper_model = WhisperModel(model, device=device, download_root=model_dir)
    segments_iter, info = whisper_model.transcribe(
        file_path,
        beam_size=beam_size,
        language=language,
    )

    json.dump(
        {
            "type": "info",
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    sys.stdout.flush()

    for segment in segments_iter:
        json.dump(
            {
                "type": "segment",
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
            },
            sys.stdout,
        )
        sys.stdout.write("\n")
        sys.stdout.flush()

    json.dump({"type": "done"}, sys.stdout)
    sys.stdout.write("\n")
    sys.stdout.flush()


def main() -> None:
    parser = argparse.ArgumentParser(description="WhisperQueue transcription wrapper")
    parser.add_argument("file_path", nargs="?", help="Audio file path (not needed with --check)")
    parser.add_argument("--model", default="large-v3")
    parser.add_argument("--model_dir", default="/app/models")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--beam_size", type=int, default=5)
    parser.add_argument("--language", default=None)
    parser.add_argument("--check", action="store_true", help="Validate installation and exit")

    args = parser.parse_args()

    if args.check:
        check_installation(args.model, args.model_dir)

    if not args.file_path:
        parser.error("file_path is required unless --check is specified")

    transcribe(
        file_path=args.file_path,
        model=args.model,
        model_dir=args.model_dir,
        device=args.device,
        beam_size=args.beam_size,
        language=args.language,
    )


if __name__ == "__main__":
    main()