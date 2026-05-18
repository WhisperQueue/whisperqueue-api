import type { NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const notFoundHandler: NotFoundHandler = (_c) => {
    throw new HTTPException(404, { message: 'Not found' });
};
