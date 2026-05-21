import { appConfig } from '@/config';
import { checkWhisperBackend } from '@/utils/checkWhisperBackend';

const TICK = '✓';
const CROSS = '✗';
const SKIP = '–';
const LINE = '─'.repeat(52);

function row(symbol: string, label: string, detail: string): void {
    console.log(`  ${symbol}  ${label.padEnd(22)}${detail}`);
}

const result = await checkWhisperBackend();

console.log('\nWhisper Backend Check');
console.log(LINE);

row(
    result.cliAvailable ? TICK : CROSS,
    'Whisper command',
    [result.command.command, ...result.command.baseArgs].join(' ')
);

if (result.cudaAvailable === null) {
    row(SKIP, 'CUDA check skipped', `device is ${appConfig.whisper.device}`);
} else {
    row(result.cudaAvailable ? TICK : CROSS, 'CUDA available', 'nvidia-smi');
}

row(result.modelPresent ? TICK : CROSS, 'Model present', result.modelPath);
console.log(LINE);

if (result.ok) {
    console.log(`  ${TICK}  Backend ready\n`);
    process.exit(0);
} else {
    const reasons = [
        !result.cliAvailable && 'Whisper command not found — set WHISPER_COMMAND explicitly',
        result.cudaAvailable === false && 'nvidia-smi failed — check GPU driver',
        !result.modelPresent && `model weights not found at ${result.modelPath}`,
    ].filter(Boolean);

    console.log(`  ${CROSS}  Backend not ready\n`);
    for (const reason of reasons) console.log(`     • ${reason}`);
    console.log();
    process.exit(1);
}
