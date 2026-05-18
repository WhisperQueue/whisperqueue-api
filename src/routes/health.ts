import type { Hono } from 'hono';

export type HealthDeps = {
    model: string;
    device: string;
    getQueueDepth: () => number;
};

export const registerHealthRoute = (app: Hono, deps: HealthDeps): void => {
    app.get('/health', (c) =>
        c.json({
            status: 'ok',
            model: deps.model,
            device: deps.device,
            queue_depth: deps.getQueueDepth(),
        })
    );
};
