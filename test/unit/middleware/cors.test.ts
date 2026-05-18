import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createCorsMiddleware } from '@/middleware/cors';

const makeApp = (origins: string | string[]) => {
    const app = new Hono();
    app.use('*', createCorsMiddleware(origins));
    app.get('/data', (c) => c.json({ ok: true }));
    return app;
};

const preflight = (app: Hono, origin = 'http://example.com') =>
    app.request('/data', {
        method: 'OPTIONS',
        headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
    });

describe('createCorsMiddleware', () => {
    describe('allowed origin', () => {
        it('reflects exact origin when explicitly allowed', async () => {
            const res = await makeApp('http://example.com').request('/data', {
                headers: { Origin: 'http://example.com' },
            });
            expect(res.headers.get('access-control-allow-origin')).toBe('http://example.com');
        });

        it('returns * on wildcard', async () => {
            const res = await makeApp('*').request('/data', {
                headers: { Origin: 'http://anything.com' },
            });
            expect(res.headers.get('access-control-allow-origin')).toBe('*');
        });
    });

    describe('preflight OPTIONS', () => {
        it('returns 204', async () => {
            const res = await preflight(makeApp('*'));
            expect(res.status).toBe(204);
        });

        it('includes POST in allowed methods', async () => {
            const res = await preflight(makeApp('*'));
            expect(res.headers.get('access-control-allow-methods')).toContain('POST');
        });

        it('includes Authorization in allowed headers', async () => {
            const res = await preflight(makeApp('*'));
            expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
        });

        it('includes Content-Type in allowed headers', async () => {
            const res = await preflight(makeApp('*'));
            expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
        });
    });
});
