import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createErrorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFound';
import { createMockLogger } from '../../helpers/mockLogger';

const makeApp = () => {
    const app = new Hono();
    app.notFound(notFoundHandler);
    app.onError(createErrorHandler(createMockLogger()));
    return app;
};

describe('notFoundHandler', () => {
    it('returns 404 for unregistered route', async () => {
        const res = await makeApp().request('/missing');
        expect(res.status).toBe(404);
    });

    it('returns JSON body with message', async () => {
        const res = await makeApp().request('/missing');
        const body = (await res.json()) as Record<string, unknown>;
        expect(typeof body.error).toBe('string');
    });
});
