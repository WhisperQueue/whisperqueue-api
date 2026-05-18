import { type Logger, pino } from 'pino';
import pretty from 'pino-pretty';

let logger: Logger;

const createLogger = (): Logger => {
    const level = Bun.env.LOGGER_LEVEL ?? 'info';
    const usePretty = Bun.env.LOGGER_PRETTY_PRINT === 'true';

    return usePretty ? pino({ level }, pretty({ colorize: true })) : pino({ level });
};

export const getLogger = (): Logger => {
    if (!logger) {
        logger = createLogger();
    }
    return logger;
};
