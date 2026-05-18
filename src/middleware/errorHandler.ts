import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Logger } from 'pino';

const guessStatusCodeFromError = (err: Error): ContentfulStatusCode => {
    const status = (err as unknown as { status: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 600) {
        return status as ContentfulStatusCode;
    }
    return 500;
};

const toHttpException = (err: Error): HTTPException =>
    new HTTPException(guessStatusCodeFromError(err), {
        cause: err,
        message: err.message,
    });

const handleHttpException = (logger: Logger, err: HTTPException, c: Parameters<ErrorHandler>[1]) => {
    if (err.res) return err.getResponse();
    if (err.status >= 500) logger.error(err, 'Unhandled server error');
    return c.json({ status: err.status, error: err.status >= 500 ? 'Internal server error' : err.message }, err.status);
};

export const createErrorHandler =
    (logger: Logger): ErrorHandler =>
    (err, c) => {
        if (err instanceof HTTPException) return handleHttpException(logger, err, c);
        return handleHttpException(logger, toHttpException(err), c);
    };
