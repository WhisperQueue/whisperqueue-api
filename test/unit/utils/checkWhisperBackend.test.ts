import { describe, expect, it, mock } from 'bun:test';
import { mockAppConfig } from '../../helpers/mockConfig';

mock.module('@/config', () => ({ appConfig: mockAppConfig }));

import { checkWhisperBackend } from '@/utils/checkWhisperBackend';
import { resetResolvedWhisperCommand } from '@/utils/resolveWhisperCommand';

type SpawnResults = Record<string, number>;
type SpawnThrows = Set<string>;

function setupMocks(codes: SpawnResults, modelExists: boolean, throws?: SpawnThrows): () => void {
    const originalSpawn = Bun.spawn;
    Bun.spawn = ((args: string[]) => {
        const cmd = args[0] as string;
        if (throws?.has(cmd)) throw new Error(`ENOENT: ${cmd}`);
        return { exited: Promise.resolve(codes[cmd] ?? 0), stdout: null, stderr: null };
    }) as unknown as typeof Bun.spawn;
    mock.module('node:fs', () => ({ existsSync: () => modelExists }));
    return () => {
        Bun.spawn = originalSpawn;
    };
}

describe('checkWhisperBackend', () => {
    describe('device = cpu (mockAppConfig default)', () => {
        it('ok when command passes and model dir exists', async () => {
            resetResolvedWhisperCommand();
            const restore = setupMocks({ python3: 0 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(true);
            expect(result.cliAvailable).toBe(true);
            expect(result.cudaAvailable).toBeNull();
            expect(result.modelPresent).toBe(true);
            expect(result.command.command).toBe('python3');
            restore();
        });

        it('not ok when command fails', async () => {
            resetResolvedWhisperCommand();
            const restore = setupMocks({ python3: 1, 'faster-whisper-xxl': 1 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(false);
            expect(result.cliAvailable).toBe(false);
            restore();
        });

        it('not ok when command is not found (ENOENT)', async () => {
            resetResolvedWhisperCommand();
            const restore = setupMocks({}, true, new Set(['python3', 'faster-whisper-xxl']));
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(false);
            expect(result.cliAvailable).toBe(false);
            expect(result.command.command).toBe('');
            restore();
        });

        it('not ok when model dir is absent', async () => {
            resetResolvedWhisperCommand();
            const restore = setupMocks({ python3: 0 }, false);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(false);
            expect(result.modelPresent).toBe(false);
            restore();
        });
    });

    describe('device = cuda', () => {
        it('ok when command, nvidia-smi, and model all pass', async () => {
            resetResolvedWhisperCommand();
            mock.module('@/config', () => ({
                appConfig: { ...mockAppConfig, whisper: { ...mockAppConfig.whisper, device: 'cuda' } },
            }));
            const restore = setupMocks({ python3: 0, 'nvidia-smi': 0 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(true);
            expect(result.cudaAvailable).toBe(true);
            restore();
        });

        it('not ok when nvidia-smi fails', async () => {
            resetResolvedWhisperCommand();
            mock.module('@/config', () => ({
                appConfig: { ...mockAppConfig, whisper: { ...mockAppConfig.whisper, device: 'cuda' } },
            }));
            const restore = setupMocks({ python3: 0, 'nvidia-smi': 1 }, true);
            const result = await checkWhisperBackend();
            expect(result.ok).toBe(false);
            expect(result.cudaAvailable).toBe(false);
            restore();
        });
    });

    it('modelPath is constructed from /app/models + model name', async () => {
        resetResolvedWhisperCommand();
        mock.module('@/config', () => ({ appConfig: mockAppConfig }));
        const restore = setupMocks({ python3: 0 }, true);
        const result = await checkWhisperBackend();
        expect(result.modelPath).toBe(`/app/models/${mockAppConfig.whisper.model}`);
        restore();
    });
});
