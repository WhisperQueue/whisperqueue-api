import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appConfig } from '@/config';

export type BackendCheckResult = {
    ok: boolean;
    cliAvailable: boolean;
    cudaAvailable: boolean | null;
    modelPresent: boolean;
    modelPath: string;
};

async function spawnExits0(cmd: string[]): Promise<boolean> {
    try {
        const proc = Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' });
        return (await proc.exited) === 0;
    } catch {
        return false;
    }
}

async function checkCuda(isCuda: boolean): Promise<boolean | null> {
    if (!isCuda) return null;
    return spawnExits0(['nvidia-smi']);
}

export async function checkWhisperBackend(): Promise<BackendCheckResult> {
    const modelPath = join('/app/models', appConfig.whisper.model);
    const isCuda = appConfig.whisper.device === 'cuda';

    const [cliAvailable, cudaAvailable, modelPresent] = await Promise.all([
        spawnExits0(['faster-whisper', '--version']),
        checkCuda(isCuda),
        Promise.resolve(existsSync(modelPath)),
    ]);

    const cudaOk = !isCuda || cudaAvailable === true;
    const ok = cliAvailable && modelPresent && cudaOk;

    return { ok, cliAvailable, cudaAvailable, modelPresent, modelPath };
}
