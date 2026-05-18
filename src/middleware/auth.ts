import { bearerAuth } from 'hono/bearer-auth';

export const auth = (token: string) => bearerAuth({ token });
