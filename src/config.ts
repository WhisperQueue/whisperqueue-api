import { z } from 'zod';
import { createConfig } from '@/utils/createConfig';
import { envBooleanDefault } from '@/utils/envCoercions';

const AppConfigSchema = z
    .object({
        API_KEY: z.string(),
        DATABASE_PATH: z.string(),
        HOSTNAME: z.string().default('127.0.0.1'),
        PORT: z.coerce.number().int().default(5001),
        CORS_ORIGINS: z.string().default('*'),
        SECURE_HEADERS: envBooleanDefault(true),
        LOGGER_PRETTY_PRINT: envBooleanDefault(true),
        LOGGER_LEVEL: z.string().default('info'),
    })
    .transform(
        ({
            API_KEY,
            CORS_ORIGINS,
            SECURE_HEADERS,
            HOSTNAME,
            DATABASE_PATH,
            PORT,
            LOGGER_PRETTY_PRINT,
            LOGGER_LEVEL,
        }) => {
            return {
                http: {
                    hostname: HOSTNAME,
                    port: PORT,
                    apiKey: API_KEY,
                },
                cors: {
                    origins: CORS_ORIGINS.split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                },
                security: {
                    headers: SECURE_HEADERS,
                },
                database: {
                    path: DATABASE_PATH,
                },
                logger: {
                    pretty: LOGGER_PRETTY_PRINT,
                    level: LOGGER_LEVEL,
                },
            };
        }
    );

export type AppConfig = z.infer<typeof AppConfigSchema>;
export const appConfig: AppConfig = createConfig(AppConfigSchema, Bun.env);
