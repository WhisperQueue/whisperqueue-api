import { describe, expect, it, mock } from 'bun:test';
import { mockAppConfig } from '../../helpers/mockConfig';

mock.module('@/config', () => ({ appConfig: mockAppConfig }));

import { checkWhisperBackend } from '@/utils/checkWhisperBackend';

type SpawnCodes = Record<string, number>;

function setupMocks(codes: SpawnCodes, modelExists: boolean): () => void {
    const originalSpawn = Bun.spawn;
    Bun.spawn = ((args: string[]) => {
        const cmd = args[0] as string;
        return { exited: Promise.resolve(codes[cmd] ?? 0), stdout: null, stderr: null };
    }) as unknown as typeof Bun.spawn;
    mock.module('node:fs', () => ({ existsSync: () => modelExists }));
    return () => {
        Bun.spawn = originalSpawn;
    };
}

describe('checkWhisperBackend', () => {
    describe('device = cpu (mockAppConfig default)', () => {
        it('ok when CLI passes and model dir exists', async () => {
            const restore = setupMocks({ 'faster-whisper': 0 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(true);
            expect(result.cliAvailable).toBe(true);
            expect(result.cudaAvailable).toBeNull();
            expect(result.modelPresent).toBe(true);
            restore();
        });

        it('not ok when CLI fails', async () => {
            const restore = setupMocks({ 'faster-whisper': 1 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(false);
            expect(result.cliAvailable).toBe(false);
            restore();
        });

        it('not ok when model dir is absent', async () => {
            const restore = setupMocks({ 'faster-whisper': 0 }, false);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(false);
            expect(result.modelPresent).toBe(false);
            restore();
        });
    });

    describe('device = cuda', () => {
        const cudaConfig = { ...mockAppConfig, whisper: { ...mockAppConfig.whisper, device: 'cuda' } };

        it('ok when CLI, nvidia-smi, and model all pass', async () => {
            mock.module('@/config', () => ({ appConfig: cudaConfig }));
            const restore = setupMocks({ 'faster-whisper': 0, 'nvidia-smi': 0 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(true);
            expect(result.cudaAvailable).toBe(true);
            restore();
        });

        it('not ok when nvidia-smi fails', async () => {
            mock.module('@/config', () => ({ appConfig: cudaConfig }));
            const restore = setupMocks({ 'faster-whisper': 0, 'nvidia-smi': 1 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(false);
            expect(result.cudaAvailable).toBe(false);
            restore();
        });
    });

    it('modelPath is constructed from /app/models + model name', async () => {
        mock.module('@/config', () => ({ appConfig: mockAppConfig }));
        const restore = setupMocks({ 'faster-whisper': 0 }, true);
        const result = await checkWhisperBackend();
        expect(result.modelPath).toBe(`/app/models/${mockAppConfig.whisper.model}`);
        restore();
    });
});
