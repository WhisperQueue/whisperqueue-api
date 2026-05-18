import { cors } from 'hono/cors';

type CorsOptions = Parameters<typeof cors>[0];

export const createCorsMiddleware = (origins: string | string[], options?: CorsOptions) =>
    cors({
        origin: origins,
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        ...options,
    });
