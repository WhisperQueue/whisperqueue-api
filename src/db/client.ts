import { Database } from 'bun:sqlite';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

type AppSchema = typeof schema;
const dbPath = Bun.env.DATABASE_PATH ?? './sample.db';
const client = new Database(dbPath);
export const db: BunSQLiteDatabase<AppSchema> = drizzle({
    client,
    schema,
});
