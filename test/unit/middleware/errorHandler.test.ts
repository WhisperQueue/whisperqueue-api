import { beforeEach, describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createErrorHandler } from '@/middleware/errorHandler';
import type { MockLogger } from '../../helpers/mockLogger';
import { createMockLogger } from '../../helpers/mockLogger';

const makeApp = (logger: MockLogger) => {
    const app = new Hono();
    app.onError(createErrorHandler(logger));
    return app;
};

const assertInternalServerError = async (res: Response) => {
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ status: 500, error: 'Internal server error' });
};

describe('createErrorHandler', () => {
    let logger: MockLogger;

    beforeEach(() => {
        logger = createMockLogger();
    });

    describe('HTTPException with a pre-built response', () => {
        it('returns the exception response directly', async () => {
            const app = makeApp(logger);
            const builtRes = new Response('custom', { status: 418 });
            app.get('/test', () => {
                throw new HTTPException(418, { res: builtRes });
            });

            const res = await app.request('/test');
            expect(res.status).toBe(418);
        });

        it('does not log when exception has a pre-built response', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                throw new HTTPException(418, { res: new Response('', { status: 418 }) });
            });
            await app.request('/test');
            expect(logger.error).not.toHaveBeenCalled();
        });
    });

    describe('HTTPException 4xx', () => {
        it('returns JSON with status and message', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                throw new HTTPException(400, { message: 'Bad input' });
            });

            const res = await app.request('/test');
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body).toEqual({ status: 400, error: 'Bad input' });
        });

        it('does not log 4xx errors', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                throw new HTTPException(404, { message: 'Not found' });
            });
            await app.request('/test');
            expect(logger.error).not.toHaveBeenCalled();
        });
    });

    describe('HTTPException 5xx', () => {
        it('returns JSON with generic message', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                throw new HTTPException(500, { message: 'Boom' });
            });
            await assertInternalServerError(await app.request('/test'));
        });

        it('logs 5xx errors', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                throw new HTTPException(503, { message: 'Unavailable' });
            });
            await app.request('/test');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('unknown errors', () => {
        it('returns 500 JSON for plain Error', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                throw new Error('unexpected');
            });
            await assertInternalServerError(await app.request('/test'));
        });

        it('preserves guessed 4xx status and message for error with status property', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                const err = Object.assign(new Error('Bad input'), { status: 400 });
                throw err;
            });
            const res = await app.request('/test');
            expect(res.status).toBe(400);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.error).toBe('Bad input');
        });

        it('logs unknown errors', async () => {
            const app = makeApp(logger);
            app.get('/test', () => {
                throw new Error('unexpected');
            });
            await app.request('/test');
            expect(logger.error).toHaveBeenCalled();
        });
    });
});
