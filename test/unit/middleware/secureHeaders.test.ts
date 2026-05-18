import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createSecureHeadersMiddleware } from '@/middleware/secureHeaders';

const makeApp = (enabled: boolean) => {
    const app = new Hono();
    app.use('*', createSecureHeadersMiddleware(enabled));
    app.get('/ok', (c) => c.text('ok'));
    return app;
};

describe('createSecureHeadersMiddleware', () => {
    describe('enabled = true', () => {
        it('sets X-Content-Type-Options', async () => {
            const res = await makeApp(true).request('/ok');
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });

        it('sets Content-Security-Policy', async () => {
            const res = await makeApp(true).request('/ok');
            expect(res.headers.get('content-security-policy')).toBeTruthy();
        });
    });

    describe('enabled = false', () => {
        it('does not set X-Content-Type-Options', async () => {
            const res = await makeApp(false).request('/ok');
            expect(res.headers.get('x-content-type-options')).toBeNull();
        });
    });
});
