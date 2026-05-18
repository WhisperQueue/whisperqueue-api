import type { z } from 'zod';

const REQUIRED_PATTERN = /received undefined/;

function formatIssue(issue: z.core.$ZodIssue): string {
    const path = issue.path.join('.') || '(root)';
    const isMissing = issue.code === 'invalid_type' && REQUIRED_PATTERN.test(issue.message);
    const prefix = isMissing ? 'is required but was not set' : issue.message;
    return `  ${path} ${prefix}`;
}

export function createConfig<T>(
    schema: z.ZodType<T>,
    env: Record<string, string | undefined> = Bun.env,
    overrides?: Record<string, string>
): T {
    const merged = { ...env, ...overrides };
    const result = schema.safeParse(merged);

    if (!result.success) {
        const issues = result.error.issues.map(formatIssue).join('\n');
        console.error(`Invalid configuration:\n${issues}`);
        process.exit(1);
    }

    return result.data;
}
