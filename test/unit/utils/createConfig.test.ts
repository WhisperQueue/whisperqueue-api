import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { z } from 'zod';
import { createConfig } from '@/utils/createConfig';

const schema = z.object({
    HOST: z.string(),
    PORT: z.coerce.number().int().default(3000),
});

describe('createConfig', () => {
    let exitSpy: ReturnType<typeof spyOn>;

    afterEach(() => {
        exitSpy?.mockRestore();
    });

    it('returns parsed config when env is valid', () => {
        const config = createConfig(schema, {}, { HOST: 'localhost' });
        expect(config).toEqual({ HOST: 'localhost', PORT: 3000 });
    });

    it('coerces types per schema', () => {
        const config = createConfig(schema, {}, { HOST: 'localhost', PORT: '8080' });
        expect(config.PORT).toBe(8080);
    });

    it('overrides take precedence over env', () => {
        const config = createConfig(schema, { HOST: 'from-env' }, { HOST: 'from-override' });
        expect(config.HOST).toBe('from-override');
    });

    it('uses env when no override provided', () => {
        const config = createConfig(schema, { HOST: 'env-host' });
        expect(config.HOST).toBe('env-host');
    });

    it('calls process.exit(1) when required field is missing', () => {
        exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
        createConfig(schema, {});
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('calls process.exit(1) when value fails validation', () => {
        exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
        createConfig(schema, {}, { HOST: 'ok', PORT: 'not-a-number' });
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
