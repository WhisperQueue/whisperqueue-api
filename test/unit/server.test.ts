import { beforeAll, describe, expect, it, mock } from 'bun:test';
import type { Hono } from 'hono';
import type { AppDeps } from '@/server';
import { createMockLogger } from '../helpers/mockLogger';

mock.module('@/config', () => ({
    appConfig: {
        http: { hostname: '127.0.0.1', port: 5001, apiKey: 'test-key' },
        cors: { origins: ['*'] },
        security: { headers: false },
        database: { path: ':memory:' },
        logger: { level: 'silent', pretty: false },
    },
}));

const deps: AppDeps = {
    logger: createMockLogger(),
    health: {
        model: 'large-v3',
        device: 'cuda',
        getQueueDepth: () => 0,
        backend: {
            ok: true,
            cliAvailable: true,
            cudaAvailable: true,
            modelPresent: true,
            modelPath: '/app/models/large-v3',
            command: { command: 'python3', baseArgs: ['/app/scripts/transcribe.py'] },
        },
    },
};

let app: Hono;

beforeAll(async () => {
    const { createHttpServer } = await import('@/server');
    app = createHttpServer(deps);
});

describe('createHttpServer', () => {
    describe('GET /health', () => {
        it('returns 200 without auth', async () => {
            const res = await app.request('/health');
            expect(res.status).toBe(200);
        });

        it('returns correct health shape', async () => {
            const body = (await (await app.request('/health')).json()) as Record<string, unknown>;
            expect(body.status).toBe('ok');
            expect(body.model).toBe('large-v3');
            expect(body.device).toBe('cuda');
            expect(typeof body.queue_depth).toBe('number');
        });
    });

    describe('unknown routes', () => {
        it('returns 404 for unregistered path', async () => {
            const res = await app.request('/does-not-exist');
            expect(res.status).toBe(404);
        });
    });

    describe('trailing slash', () => {
        it('redirects /health/ to /health', async () => {
            const res = await app.request('/health/');
            expect(res.status).toBe(301);
            expect(res.headers.get('location')).toMatch(/\/health$/);
        });
    });
});
