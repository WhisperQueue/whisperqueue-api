import { Hono } from 'hono';
import { trimTrailingSlash } from 'hono/trailing-slash';
import type { Logger } from 'pino';
import { appConfig } from '@/config';
import { createCorsMiddleware } from '@/middleware/cors';
import { createErrorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFound';
import { createSecureHeadersMiddleware } from '@/middleware/secureHeaders';
import type { HealthDeps } from '@/routes/health';
import { registerHealthRoute } from '@/routes/health';

export type AppDeps = {
    logger: Logger;
    health: HealthDeps;
};

export const createHttpServer = ({ logger, health }: AppDeps): Hono => {
    const app = new Hono();

    app.use('*', createCorsMiddleware(appConfig.cors.origins));
    app.use('*', createSecureHeadersMiddleware(appConfig.security.headers));
    app.use('*', trimTrailingSlash({ alwaysRedirect: true }));
    app.notFound(notFoundHandler);
    app.onError(createErrorHandler(logger));

    registerHealthRoute(app, health);

    return app;
};
