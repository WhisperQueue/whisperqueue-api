import { appConfig } from '@/config';
import { createHttpServer } from '@/server';
import { getLogger } from '@/utils/logger';

const startServer = () => {
    const logger = getLogger();

    const app = createHttpServer({
        logger,
        health: {
            model: 'large-v3',
            device: 'cuda',
            getQueueDepth: () => 0,
        },
    });

    logger.info(`Server listening on http://${appConfig.http.hostname}:${appConfig.http.port}`);

    return {
        port: appConfig.http.port,
        hostname: appConfig.http.hostname,
        fetch: app.fetch,
    };
};

export default startServer();
