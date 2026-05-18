import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { auth } from '@/middleware/auth';

const TOKEN = 'test-secret-key';

const makeApp = () => {
    const app = new Hono();
    app.use('/secure', auth(TOKEN));
    app.get('/secure', (c) => c.json({ ok: true }));
    return app;
};

describe('auth', () => {
    it('returns 401 when Authorization header is missing', async () => {
        const res = await makeApp().request('/secure');
        expect(res.status).toBe(401);
    });

    it('returns 401 for wrong token', async () => {
        const res = await makeApp().request('/secure', {
            headers: { Authorization: 'Bearer wrong-token' },
        });
        expect(res.status).toBe(401);
    });

    it('returns 400 for malformed Authorization header (missing Bearer prefix)', async () => {
        const res = await makeApp().request('/secure', {
            headers: { Authorization: TOKEN },
        });
        expect(res.status).toBe(400);
    });

    it('passes through with valid Bearer token', async () => {
        const res = await makeApp().request('/secure', {
            headers: { Authorization: `Bearer ${TOKEN}` },
        });
        expect(res.status).toBe(200);
    });
});
