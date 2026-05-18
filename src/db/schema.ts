import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const transcriptions = sqliteTable('transcriptions', {
    id: text('id').primaryKey(),
    file_hash: text('file_hash').notNull().unique(),
    file_url: text('file_url').notNull(),
    text: text('text').notNull(),
    segments: text('segments').notNull(),
    language: text('language').notNull(),
    duration: real('duration').notNull(),
    model: text('model').notNull(),
    created_at: integer('created_at').notNull(),
});
