import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

export type SecureHeadersOptions = Parameters<typeof secureHeaders>[0];

const DEFAULT_OPTIONS: SecureHeadersOptions = {
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
    },
    crossOriginEmbedderPolicy: false,
};

export const createSecureHeadersMiddleware = (enabled: boolean, options?: SecureHeadersOptions): MiddlewareHandler =>
    enabled ? secureHeaders(options ?? DEFAULT_OPTIONS) : (_c, next) => next();
