import { z } from 'zod';
import { createConfig } from '@/utils/createConfig';
import { envBooleanDefault } from '@/utils/envCoercions';

const AppConfigSchema = z
    .object({
        // Auth
        API_KEY: z.string().min(1),

        // HTTP server
        HOSTNAME: z.string().default('127.0.0.1'),
        PORT: z.coerce.number().int().default(5001),

        // CORS
        CORS_ORIGINS: z.string().default('*'),

        // Security
        SECURE_HEADERS: envBooleanDefault(true),

        // Database
        DATABASE_PATH: z.string(),

        // Logging
        LOGGER_LEVEL: z.string().default('info'),
        LOGGER_PRETTY_PRINT: envBooleanDefault(false),

        // Whisper
        WHISPER_MODEL: z.string().default('large-v3'),
        WHISPER_DEVICE: z.string().default('cuda'),
        BEAM_SIZE: z.coerce.number().int().default(5),

        // Download
        MAX_FILE_SIZE_MB: z.coerce.number().int().default(500),
        DOWNLOAD_TIMEOUT_SECONDS: z.coerce.number().int().default(120),

        // S3 / MinIO
        S3_ENDPOINT_URL: z.string().optional(),
        AWS_ACCESS_KEY_ID: z.string().optional(),
        AWS_SECRET_ACCESS_KEY: z.string().optional(),
        AWS_REGION: z.string().default('us-east-1'),
    })
    .transform(
        ({
            API_KEY,
            HOSTNAME,
            PORT,
            CORS_ORIGINS,
            SECURE_HEADERS,
            DATABASE_PATH,
            LOGGER_LEVEL,
            LOGGER_PRETTY_PRINT,
            WHISPER_MODEL,
            WHISPER_DEVICE,
            BEAM_SIZE,
            MAX_FILE_SIZE_MB,
            DOWNLOAD_TIMEOUT_SECONDS,
            S3_ENDPOINT_URL,
            AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY,
            AWS_REGION,
        }) => ({
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
                level: LOGGER_LEVEL,
                pretty: LOGGER_PRETTY_PRINT,
            },
            whisper: {
                model: WHISPER_MODEL,
                device: WHISPER_DEVICE,
                beamSize: BEAM_SIZE,
            },
            download: {
                maxFileSizeMb: MAX_FILE_SIZE_MB,
                timeoutSeconds: DOWNLOAD_TIMEOUT_SECONDS,
            },
            s3: {
                endpointUrl: S3_ENDPOINT_URL,
                accessKeyId: AWS_ACCESS_KEY_ID,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
                region: AWS_REGION,
            },
        })
    );

export type AppConfig = z.infer<typeof AppConfigSchema>;
export const appConfig: AppConfig = createConfig(AppConfigSchema, Bun.env);
