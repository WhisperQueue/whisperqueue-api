import { z } from 'zod';

const BOOL_MAP: Record<string, boolean> = {
    true: true,
    '1': true,
    yes: true,
    false: false,
    '0': false,
    no: false,
    '': false,
};

function coerceEnvBool(val: string | undefined, def: boolean): boolean {
    if (val === undefined) return def;
    const result = BOOL_MAP[val.toLowerCase()];
    return result !== undefined ? result : def;
}

export function envBooleanDefault(def: boolean) {
    return z
        .string()
        .optional()
        .transform((val) => coerceEnvBool(val, def))
        .pipe(z.boolean());
}
