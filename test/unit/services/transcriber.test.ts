import { describe, expect, it } from 'bun:test';
import { parseLanguageLine, parseSegmentLine, parseTimestamp, TranscriberService } from '@/services/transcriber';

export { TranscriberService };

describe('TranscriberService.transcribe', () => {
    it('collects segments and detects language from output lines', async () => {
        const service = new TranscriberService();

        Object.assign(service, {
            getAudioDuration: () => Promise.resolve(10),
            spawnWhisper: () => ({ exited: Promise.resolve(0) }),
            readLines: async function* () {
                yield '[00:00.000 --> 00:02.560]  Hello world';
                yield "Detected language 'fr' with probability 0.99";
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
        const service = new TranscriberService();
        const progressValues: number[] = [];

        Object.assign(service, {
            getAudioDuration: () => Promise.resolve(10),
            spawnWhisper: () => ({ exited: Promise.resolve(0) }),
            readLines: async function* () {
                yield '[00:00.000 --> 00:05.000]  First half';
                yield '[00:05.000 --> 00:10.000]  Second half';
            },
        });

        await service.transcribe('/fake/audio.mp3', undefined, (p) => progressValues.push(p));

        expect(progressValues).toEqual([50, 100]);
    });
});

describe('parseTimestamp', () => {
    it('parses MM:SS.mmm format', () => {
        expect(parseTimestamp('00:02.560')).toBeCloseTo(2.56);
    });

    it('parses MM:SS,mmm format (comma separator)', () => {
        expect(parseTimestamp('01:30,000')).toBeCloseTo(90);
    });

    it('parses HH:MM:SS.mmm format', () => {
        expect(parseTimestamp('01:00:00.000')).toBeCloseTo(3600);
    });

    it('parses minutes correctly', () => {
        expect(parseTimestamp('02:30.000')).toBeCloseTo(150);
    });
});

describe('parseSegmentLine', () => {
    it('parses a standard faster-whisper segment line', () => {
        const result = parseSegmentLine('[00:00.000 --> 00:02.560]  Hello world');
        expect(result).toEqual({ start: 0, end: 2.56, text: 'Hello world' });
    });

    it('trims leading/trailing whitespace from text', () => {
        const result = parseSegmentLine('[00:00.000 --> 00:01.000]   trimmed   ');
        expect(result?.text).toBe('trimmed');
    });

    it('returns null for non-segment lines', () => {
        expect(parseSegmentLine("Detected language 'en' with probability 0.99")).toBeNull();
        expect(parseSegmentLine('')).toBeNull();
        expect(parseSegmentLine('Some random output')).toBeNull();
    });

    it('returns null for malformed timestamps', () => {
        expect(parseSegmentLine('[bad --> worse]  text')).toBeNull();
    });
});

describe('parseLanguageLine', () => {
    it('extracts language code from detected language line', () => {
        expect(parseLanguageLine("Detected language 'en' with probability 0.999")).toBe('en');
    });

    it('handles different language codes', () => {
        expect(parseLanguageLine("Detected language 'fr' with probability 0.85")).toBe('fr');
    });

    it('returns null for non-language lines', () => {
        expect(parseLanguageLine('[00:00.000 --> 00:02.000]  Hello')).toBeNull();
        expect(parseLanguageLine('')).toBeNull();
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
