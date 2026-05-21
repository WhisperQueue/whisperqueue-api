import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { HealthDeps } from '@/routes/health';
import { registerHealthRoute } from '@/routes/health';

const mockBackend = {
    ok: true,
    cliAvailable: true,
    cudaAvailable: true,
    modelPresent: true,
    modelPath: '/app/models/large-v3',
    command: { command: 'python3', baseArgs: ['/app/scripts/transcribe.py'] },
};

const makeApp = (queueDepth = 0, overrides: Partial<HealthDeps> = {}) => {
    const app = new Hono();
    registerHealthRoute(app, {
        model: 'large-v3',
        device: 'cuda',
        getQueueDepth: () => queueDepth,
        backend: mockBackend,
        ...overrides,
    });
    return app;
};

describe('GET /health', () => {
    it('returns 200', async () => {
        const res = await makeApp().request('/health');
        expect(res.status).toBe(200);
    });

    it('returns correct shape including backend', async () => {
        const res = await makeApp(2).request('/health');
        const body = await res.json();
        expect(body).toEqual({
            status: 'ok',
            model: 'large-v3',
            device: 'cuda',
            queue_depth: 2,
            backend: {
                cli_available: true,
                cuda_available: true,
                model_present: true,
                model_path: '/app/models/large-v3',
                command: { command: 'python3', baseArgs: ['/app/scripts/transcribe.py'] },
            },
        });
    });

    it('reflects model and device from deps', async () => {
        const app = new Hono();
        registerHealthRoute(app, {
            model: 'tiny',
            device: 'cpu',
            getQueueDepth: () => 0,
            backend: { ...mockBackend, cudaAvailable: null },
        });
        const res = await app.request('/health');
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.model).toBe('tiny');
        expect(body.device).toBe('cpu');
    });

    it('calls getQueueDepth on every request', async () => {
        let calls = 0;
        const app = new Hono();
        registerHealthRoute(app, {
            model: 'large-v3',
            device: 'cuda',
            getQueueDepth: () => ++calls,
            backend: mockBackend,
        });
        await app.request('/health');
        await app.request('/health');
        expect(calls).toBe(2);
    });
});
