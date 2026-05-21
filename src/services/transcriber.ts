import { appConfig } from '@/config';
import { getResolvedWhisperCommand } from '@/utils/resolveWhisperCommand';

export type Segment = {
    start: number;
    end: number;
    text: string;
};

export type TranscriptionResult = {
    text: string;
    language: string;
    duration: number;
    segments: Segment[];
};

type InfoLine = {
    type: 'info';
    language: string;
    language_probability: number;
    duration: number;
};

type SegmentLine = {
    type: 'segment';
    start: number;
    end: number;
    text: string;
};

type DoneLine = { type: 'done' };

type WhisperOutput = InfoLine | SegmentLine | DoneLine;

function parseWhisperLine(line: string): WhisperOutput | null {
    try {
        return JSON.parse(line) as WhisperOutput;
    } catch {
        return null;
    }
}

function findDuration(streams: Array<{ duration?: string }>): number {
    for (const stream of streams) {
        const d = Number(stream.duration);
        if (Number.isFinite(d) && d > 0) return d;
    }
    return 0;
}

function parseDuration(json: { streams: Array<{ duration?: string }>; format?: { duration?: string } }): number {
    return findDuration(json.streams) || findDuration([json.format ?? {}]);
}

export class TranscriberService {
    // fallow-ignore-next-line complexity
    async transcribe(
        filePath: string,
        language?: string,
        onProgress?: (progress: number) => void
    ): Promise<TranscriptionResult> {
        const { command, baseArgs } = getResolvedWhisperCommand();
        const proc = this.spawnWhisper(command, baseArgs, filePath, language);

        const segments: Segment[] = [];
        let detectedLanguage: string | undefined;
        let duration = 0;

        for await (const line of this.readLines(proc)) {
            this.processLine(
                line,
                segments,
                (info) => {
                    detectedLanguage = info.language;
                    duration = info.duration || 0;
                },
                duration,
                onProgress
            );
        }

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            throw new Error(`Whisper command exited with code ${exitCode}`);
        }

        if (duration === 0) {
            duration = await this.getAudioDuration(filePath);
        }

        return {
            text: segments.map((s) => s.text).join(' '),
            language: detectedLanguage ?? language ?? 'en',
            duration,
            segments,
        };
    }

    // fallow-ignore-next-line complexity
    protected processLine(
        line: string,
        segments: Segment[],
        onInfo: (info: InfoLine) => void,
        duration: number,
        onProgress?: (progress: number) => void
    ): void {
        const parsed = parseWhisperLine(line);
        if (!parsed) return;

        if (parsed.type === 'info') {
            onInfo(parsed);
        } else if (parsed.type === 'segment') {
            segments.push({ start: parsed.start, end: parsed.end, text: parsed.text });
            if (onProgress && duration > 0) {
                onProgress(Math.round((parsed.end / duration) * 100));
            }
        }
    }

    protected spawnWhisper(
        command: string,
        baseArgs: string[],
        filePath: string,
        language?: string
    ): ReturnType<typeof Bun.spawn> {
        const args = [
            command,
            ...baseArgs,
            filePath,
            '--model',
            appConfig.whisper.model,
            '--model_dir',
            '/app/models',
            '--device',
            appConfig.whisper.device,
            '--beam_size',
            String(appConfig.whisper.beamSize),
        ];
        if (language) args.push('--language', language);
        return Bun.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    }

    protected async *readLines(proc: ReturnType<typeof Bun.spawn>): AsyncIterable<string> {
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            yield* lines;
        }
        buffer += decoder.decode();
        if (buffer) yield buffer;
    }

    async getAudioDuration(filePath: string): Promise<number> {
        const proc = Bun.spawn(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', filePath],
            { stdout: 'pipe', stderr: 'ignore' }
        );

        const chunks: Uint8Array[] = [];
        for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
            chunks.push(chunk);
        }

        const exitCode = await proc.exited;
        if (exitCode !== 0) throw new Error(`ffprobe exited with code ${exitCode}`);

        const json = JSON.parse(Buffer.concat(chunks).toString()) as {
            streams: Array<{ duration?: string }>;
            format?: { duration?: string };
        };

        return parseDuration(json);
    }
}

let instance: TranscriberService | undefined;

export function getTranscriberService(): TranscriberService {
    if (!instance) instance = new TranscriberService();
    return instance;
}
