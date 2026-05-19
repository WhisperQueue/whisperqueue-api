import { appConfig } from '@/config';

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

const SEGMENT_RE = /^\[(\d{2}(?::\d{2}){1,2}[.:]\d{3}) --> (\d{2}(?::\d{2}){1,2}[.:]\d{3})]\s+(.*)/;
const LANGUAGE_RE = /Detected language '(\w+)'/;

export function parseTimestamp(ts: string): number {
    const parts = ts.replace(',', '.').split(':');
    if (parts.length === 2) {
        return Number(parts[0]) * 60 + Number(parts[1]);
    }
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
}

export function parseSegmentLine(line: string): Segment | null {
    const m = SEGMENT_RE.exec(line);
    if (!m) return null;
    const start = m[1] as string;
    const end = m[2] as string;
    const text = m[3] as string;
    return { start: parseTimestamp(start), end: parseTimestamp(end), text: text.trim() };
}

export function parseLanguageLine(line: string): string | null {
    return LANGUAGE_RE.exec(line)?.[1] ?? null;
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
    async transcribe(
        filePath: string,
        language?: string,
        onProgress?: (progress: number) => void
    ): Promise<TranscriptionResult> {
        const totalDuration = await this.getAudioDuration(filePath);
        const segments: Segment[] = [];
        const detected = await this.runWhisper(filePath, language, segments, totalDuration, onProgress);
        return {
            text: segments.map((s) => s.text).join(' '),
            language: detected ?? language ?? 'en',
            duration: totalDuration,
            segments,
        };
    }

    protected async runWhisper(
        filePath: string,
        language: string | undefined,
        segments: Segment[],
        totalDuration: number,
        onProgress?: (progress: number) => void
    ): Promise<string | undefined> {
        const proc = this.spawnWhisper(filePath, language);
        let detected: string | undefined;

        for await (const line of this.readLines(proc)) {
            const lang = this.processLine(line, segments, totalDuration, onProgress);
            if (lang) detected = lang;
        }

        const exitCode = await proc.exited;
        if (exitCode !== 0) throw new Error(`faster-whisper exited with code ${exitCode}`);
        return detected;
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

    protected processLine(
        line: string,
        segments: Segment[],
        totalDuration: number,
        onProgress?: (progress: number) => void
    ): string | null {
        const segment = parseSegmentLine(line);
        if (segment) {
            segments.push(segment);
            if (onProgress && totalDuration > 0) {
                onProgress(Math.round((segment.end / totalDuration) * 100));
            }
            return null;
        }
        return parseLanguageLine(line);
    }

    protected spawnWhisper(filePath: string, language?: string): ReturnType<typeof Bun.spawn> {
        const args = [
            'faster-whisper',
            filePath,
            '--model',
            appConfig.whisper.model,
            '--device',
            appConfig.whisper.device,
            '--beam_size',
            String(appConfig.whisper.beamSize),
        ];
        if (language) args.push('--language', language);
        return Bun.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    }
}

let instance: TranscriberService | undefined;

export function getTranscriberService(): TranscriberService {
    if (!instance) instance = new TranscriberService();
    return instance;
}
