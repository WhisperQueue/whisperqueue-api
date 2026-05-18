import { describe, expect, it } from 'bun:test';
import { getLogger } from '@/utils/logger';

describe('getLogger', () => {
    it('returns a logger with expected pino methods', () => {
        const logger = getLogger();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.debug).toBe('function');
    });

    it('returns the same instance on repeated calls', () => {
        const a = getLogger();
        const b = getLogger();
        expect(a).toBe(b);
    });

    it('exposes a valid pino log level', () => {
        const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
        expect(validLevels).toContain(getLogger().level);
    });
});
