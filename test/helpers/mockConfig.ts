import type { AppConfig } from '@/config';

export const mockAppConfig: AppConfig = {
    http: { hostname: '127.0.0.1', port: 5001, apiKey: 'test-key' },
    cors: { origins: ['*'] },
    security: { headers: false },
    database: { path: ':memory:' },
    logger: { level: 'silent', pretty: false },
    whisper: { model: 'tiny', device: 'cpu', beamSize: 1 },
    download: { maxFileSizeMb: 10, timeoutSeconds: 5 },
    s3: {
        endpointUrl: undefined,
        accessKeyId: undefined,
        secretAccessKey: undefined,
        region: 'us-east-1',
    },
};
