import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { registerHealthRoute } from '@/routes/health';

const makeApp = (queueDepth = 0) => {
    const app = new Hono();
    registerHealthRoute(app, { model: 'large-v3', device: 'cuda', getQueueDepth: () => queueDepth });
    return app;
};

describe('GET /health', () => {
    it('returns 200', async () => {
        const res = await makeApp().request('/health');
        expect(res.status).toBe(200);
    });

    it('returns correct shape', async () => {
        const res = await makeApp(2).request('/health');
        const body = await res.json();
        expect(body).toEqual({ status: 'ok', model: 'large-v3', device: 'cuda', queue_depth: 2 });
    });

    it('reflects model and device from deps', async () => {
        const app = new Hono();
        registerHealthRoute(app, { model: 'tiny', device: 'cpu', getQueueDepth: () => 0 });
        const res = await app.request('/health');
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.model).toBe('tiny');
        expect(body.device).toBe('cpu');
    });

    it('calls getQueueDepth on every request', async () => {
        let calls = 0;
        const app = new Hono();
        registerHealthRoute(app, { model: 'large-v3', device: 'cuda', getQueueDepth: () => ++calls });
        await app.request('/health');
        await app.request('/health');
        expect(calls).toBe(2);
    });
});
