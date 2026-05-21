import { describe, expect, it, mock } from 'bun:test';
import { resetResolvedWhisperCommand } from '@/utils/resolveWhisperCommand';
import { mockAppConfig } from '../../helpers/mockConfig';

mock.module('@/config', () => ({ appConfig: mockAppConfig }));

const { resolveWhisperCommand } = await import('@/utils/resolveWhisperCommand');

function setupSpawn(results: Record<string, number | Error>, throws?: Set<string>): () => void {
    const originalSpawn = Bun.spawn;
    Bun.spawn = ((_args: string[]) => {
        const cmd = _args[0] as string;
        if (throws?.has(cmd)) throw new Error(`ENOENT: ${cmd}`);
        const code = results[cmd] ?? 0;
        return { exited: Promise.resolve(code), stdout: null, stderr: null };
    }) as unknown as typeof Bun.spawn;
    return () => {
        Bun.spawn = originalSpawn;
    };
}

describe('resolveWhisperCommand', () => {
    it('returns python3 transcribe.py when auto-detect finds it first', async () => {
        resetResolvedWhisperCommand();
        const restore = setupSpawn({ python3: 0 });
        const result = await resolveWhisperCommand();
        expect(result.command).toBe('python3');
        expect(result.baseArgs).toEqual(['/app/scripts/transcribe.py']);
        restore();
    });

    it('falls back to faster-whisper-xxl when python3 is not available', async () => {
        resetResolvedWhisperCommand();
        const restore = setupSpawn({ 'faster-whisper-xxl': 0 }, new Set(['python3']));
        const result = await resolveWhisperCommand();
        expect(result.command).toBe('faster-whisper-xxl');
        expect(result.baseArgs).toEqual([]);
        restore();
    });

    it('throws when no candidate works', async () => {
        resetResolvedWhisperCommand();
        const restore = setupSpawn({}, new Set(['python3', 'faster-whisper-xxl']));
        expect(resolveWhisperCommand()).rejects.toThrow(/Auto-detection failed/);
        restore();
    });

    it('uses explicit WHISPER_COMMAND when not auto', async () => {
        resetResolvedWhisperCommand();
        mock.module('@/config', () => ({
            appConfig: { ...mockAppConfig, whisper: { ...mockAppConfig.whisper, command: '/usr/local/bin/whisper' } },
        }));
        const restore = setupSpawn({ '/usr/local/bin/whisper': 0 });
        const result = await resolveWhisperCommand();
        expect(result.command).toBe('/usr/local/bin/whisper');
        expect(result.baseArgs).toEqual([]);
        restore();
    });

    it('throws when explicit command fails --check', async () => {
        resetResolvedWhisperCommand();
        mock.module('@/config', () => ({
            appConfig: { ...mockAppConfig, whisper: { ...mockAppConfig.whisper, command: 'bad-cmd' } },
        }));
        const restore = setupSpawn({ 'bad-cmd': 1 });
        expect(resolveWhisperCommand()).rejects.toThrow(/not working/);
        restore();
    });

    it('caches the resolved command', async () => {
        resetResolvedWhisperCommand();
        mock.module('@/config', () => ({ appConfig: mockAppConfig }));
        let callCount = 0;
        const originalSpawn = Bun.spawn;
        Bun.spawn = ((_args: string[]) => {
            callCount++;
            return { exited: Promise.resolve(0), stdout: null, stderr: null };
        }) as unknown as typeof Bun.spawn;

        await resolveWhisperCommand();
        await resolveWhisperCommand();
        expect(callCount).toBe(1);

        Bun.spawn = originalSpawn;
    });
});
