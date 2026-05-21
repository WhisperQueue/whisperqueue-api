import { appConfig } from '@/config';

export type ResolvedWhisperCommand = {
    command: string;
    baseArgs: string[];
};

const CANDIDATES: ResolvedWhisperCommand[] = [
    { command: 'python3', baseArgs: ['/app/scripts/transcribe.py'] },
    { command: 'faster-whisper-xxl', baseArgs: [] },
];

let cached: ResolvedWhisperCommand | undefined;

function parseCommand(input: string): ResolvedWhisperCommand {
    const parts = input.trim().split(/\s+/);
    const command = parts.shift();
    if (!command) throw new Error('WHISPER_COMMAND is empty');
    return { command, baseArgs: parts };
}

async function tryCommand(cmd: ResolvedWhisperCommand): Promise<boolean> {
    try {
        const proc = Bun.spawn([cmd.command, ...cmd.baseArgs, '--check'], {
            stdout: 'ignore',
            stderr: 'ignore',
        });
        return (await proc.exited) === 0;
    } catch {
        return false;
    }
}

// fallow-ignore-next-line complexity
export async function resolveWhisperCommand(): Promise<ResolvedWhisperCommand> {
    if (cached) return cached;

    const raw = appConfig.whisper.command;

    if (raw !== 'auto') {
        const resolved = parseCommand(raw);
        const ok = await tryCommand(resolved);
        if (!ok) {
            throw new Error(`WHISPER_COMMAND="${raw}" is not working. Verify the command exists and --check exits 0.`);
        }
        cached = resolved;
        return resolved;
    }

    for (const candidate of CANDIDATES) {
        if (await tryCommand(candidate)) {
            cached = candidate;
            return candidate;
        }
    }

    throw new Error(
        `Auto-detection failed. Tried: ${CANDIDATES.map((c) => [c.command, ...c.baseArgs].join(' ')).join(', ')}. ` +
            'Set WHISPER_COMMAND explicitly or verify your installation.'
    );
}

export function getResolvedWhisperCommand(): ResolvedWhisperCommand {
    if (!cached) throw new Error('Whisper command not resolved yet. Call resolveWhisperCommand() first.');
    return cached;
}

export function resetResolvedWhisperCommand(): void {
    cached = undefined;
}
