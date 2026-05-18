import { mock } from 'bun:test';
import type { Logger } from 'pino';

export type MockLogger = {
    [K in keyof Logger]: Logger[K] extends (...args: infer A) => infer R
        ? ReturnType<typeof mock<(...args: A) => R>>
        : Logger[K];
};

export const createMockLogger = (): MockLogger => {
    const noop = mock(() => {});
    const logger = {
        info: noop,
        error: noop,
        warn: noop,
        debug: noop,
        fatal: noop,
        trace: noop,
        silent: noop,
        child: mock(() => logger),
        level: 'silent',
    } as unknown as MockLogger;
    return logger;
};
