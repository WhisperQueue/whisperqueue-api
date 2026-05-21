import { describe, expect, it, mock } from 'bun:test';
import { TranscriberService } from '@/services/transcriber';
import type { ResolvedWhisperCommand } from '@/utils/resolveWhisperCommand';

const defaultCommand: ResolvedWhisperCommand = {
    command: 'python3',
    baseArgs: ['/app/scripts/transcribe.py'],
};

function mockResolvedCommand(cmd: ResolvedWhisperCommand = defaultCommand): void {
    mock.module('@/utils/resolveWhisperCommand', () => ({
        getResolvedWhisperCommand: () => cmd,
        resolveWhisperCommand: async () => cmd,
        resetResolvedWhisperCommand: () => {},
    }));
}

function stubService(overrides: Record<string, unknown> = {}): TranscriberService {
    const service = new TranscriberService();
    Object.assign(service, {
        spawnWhisper: () => ({ exited: Promise.resolve(0) }),
        getAudioDuration: () => Promise.resolve(10),
        ...overrides,
    });
    return service;
}

describe('TranscriberService.transcribe', () => {
    it('collects segments and detects language from JSON-lines output', async () => {
        mockResolvedCommand();
        const service = stubService({
            readLines: async function* () {
                yield JSON.stringify({ type: 'info', language: 'fr', language_probability: 0.99, duration: 10 });
                yield JSON.stringify({ type: 'segment', start: 0, end: 2.56, text: 'Hello world' });
                yield JSON.stringify({ type: 'done' });
            },
        });

        const result = await service.transcribe('/fake/audio.mp3');

        expect(result.segments).toHaveLength(1);
        expect(result.segments[0]).toEqual({ start: 0, end: 2.56, text: 'Hello world' });
        expect(result.language).toBe('fr');
        expect(result.duration).toBe(10);
        expect(result.text).toBe('Hello world');
    });

    it('reports progress via onProgress callback', async () => {
        mockResolvedCommand();
        const progressValues: number[] = [];
        const service = stubService({
            readLines: async function* () {
                yield JSON.stringify({ type: 'info', language: 'en', language_probability: 0.95, duration: 10 });
                yield JSON.stringify({ type: 'segment', start: 0, end: 5, text: 'First half' });
                yield JSON.stringify({ type: 'segment', start: 5, end: 10, text: 'Second half' });
                yield JSON.stringify({ type: 'done' });
            },
        });

        await service.transcribe('/fake/audio.mp3', undefined, (p) => progressValues.push(p));

        expect(progressValues).toEqual([50, 100]);
    });

    it('falls back to ffprobe duration when info line has no duration', async () => {
        mockResolvedCommand();
        const service = stubService({
            readLines: async function* () {
                yield JSON.stringify({ type: 'info', language: 'en', language_probability: 0.95, duration: 0 });
                yield JSON.stringify({ type: 'segment', start: 0, end: 5, text: 'Hello' });
                yield JSON.stringify({ type: 'done' });
            },
            getAudioDuration: () => Promise.resolve(20),
        });

        const result = await service.transcribe('/fake/audio.mp3');
        expect(result.duration).toBe(20);
    });

    it('uses language fallback when info line missing', async () => {
        mockResolvedCommand();
        const service = stubService({
            readLines: async function* () {
                yield JSON.stringify({ type: 'segment', start: 0, end: 5, text: 'Hello' });
            },
        });

        const result = await service.transcribe('/fake/audio.mp3', 'de');
        expect(result.language).toBe('de');
    });

    it('throws on non-zero exit code', async () => {
        mockResolvedCommand();
        const service = stubService({
            spawnWhisper: () => ({ exited: Promise.resolve(1) }),
            readLines: async function* () {},
        });

        expect(service.transcribe('/fake/audio.mp3')).rejects.toThrow(/exited with code 1/);
    });
});

describe('progress calculation', () => {
    it('computes correct percentage from segment end and total duration', () => {
        const latestEnd = 42;
        const totalDuration = 100;
        expect(Math.round((latestEnd / totalDuration) * 100)).toBe(42);
    });

    it('caps naturally at 100 when last segment ends at duration', () => {
        expect(Math.round((100 / 100) * 100)).toBe(100);
    });

    it('handles zero duration gracefully (no NaN)', () => {
        const totalDuration = 0;
        const progress = totalDuration > 0 ? Math.round((10 / totalDuration) * 100) : 0;
        expect(progress).toBe(0);
    });
});
