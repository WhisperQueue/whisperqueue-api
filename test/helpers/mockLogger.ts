import { mock } from 'bun:test';
import type { Logger } from 'pino';

export type MockLogger = Logger & {
    info: ReturnType<typeof mock>;
    error: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
    debug: ReturnType<typeof mock>;
    fatal: ReturnType<typeof mock>;
    trace: ReturnType<typeof mock>;
};

export const createMockLogger = (): MockLogger => {
    const noop = mock(() => {});
    return {
        info: noop,
        error: noop,
        warn: noop,
        debug: noop,
        fatal: noop,
        trace: noop,
        silent: noop,
        child: mock(() => createMockLogger()),
        level: 'silent',
    } as unknown as MockLogger;
};
