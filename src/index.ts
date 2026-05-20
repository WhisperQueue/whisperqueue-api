import { appConfig } from '@/config';
import { createHttpServer } from '@/server';
import { checkWhisperBackend } from '@/utils/checkWhisperBackend';
import { getLogger } from '@/utils/logger';

const startServer = async () => {
    const logger = getLogger();

    const backend = await checkWhisperBackend();

    if (!backend.ok) {
        logger.error(
            {
                cliAvailable: backend.cliAvailable,
                cudaAvailable: backend.cudaAvailable,
                modelPresent: backend.modelPresent,
                modelPath: backend.modelPath,
            },
            'Whisper backend check failed — aborting startup'
        );
        process.exit(1);
    }

    logger.info({ model: backend.modelPath, device: appConfig.whisper.device }, 'Whisper backend ready');

    const app = createHttpServer({
        logger,
        health: {
            model: appConfig.whisper.model,
            device: appConfig.whisper.device,
            getQueueDepth: () => 0,
            backend,
        },
    });

    logger.info(`Server listening on http://${appConfig.http.hostname}:${appConfig.http.port}`);

    return {
        port: appConfig.http.port,
        hostname: appConfig.http.hostname,
        fetch: app.fetch,
    };
};

export default await startServer();
