import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { envBooleanDefault } from '@/utils/envCoercions';

describe('envBooleanDefault', () => {
    const schema = (def: boolean) => z.object({ FLAG: envBooleanDefault(def) });

    describe('truthy string values', () => {
        it.each(['true', '1', 'yes', 'TRUE', 'YES', 'True'])('parses %s as true', (val) => {
            expect(schema(false).parse({ FLAG: val }).FLAG).toBe(true);
        });
    });

    describe('falsy string values', () => {
        it.each(['false', '0', 'no', 'FALSE', 'NO', 'False', ''])('parses %s as false', (val) => {
            expect(schema(true).parse({ FLAG: val }).FLAG).toBe(false);
        });
    });

    describe('undefined falls back to default', () => {
        it('returns true when default is true and value is absent', () => {
            expect(schema(true).parse({}).FLAG).toBe(true);
        });

        it('returns false when default is false and value is absent', () => {
            expect(schema(false).parse({}).FLAG).toBe(false);
        });
    });

    describe('unrecognised value falls back to default', () => {
        it('returns default true for unknown string', () => {
            expect(schema(true).parse({ FLAG: 'maybe' }).FLAG).toBe(true);
        });

        it('returns default false for unknown string', () => {
            expect(schema(false).parse({ FLAG: 'maybe' }).FLAG).toBe(false);
        });
    });
});
