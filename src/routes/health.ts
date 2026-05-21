import type { Hono } from 'hono';
import type { BackendCheckResult } from '@/utils/checkWhisperBackend';

export type HealthDeps = {
    model: string;
    device: string;
    getQueueDepth: () => number;
    backend: BackendCheckResult;
};

export const registerHealthRoute = (app: Hono, deps: HealthDeps): void => {
    app.get('/health', (c) =>
        c.json({
            status: 'ok',
            model: deps.model,
            device: deps.device,
            queue_depth: deps.getQueueDepth(),
            backend: {
                cli_available: deps.backend.cliAvailable,
                cuda_available: deps.backend.cudaAvailable,
                model_present: deps.backend.modelPresent,
                model_path: deps.backend.modelPath,
                command: deps.backend.command,
            },
        })
    );
};
