import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }),
    userName: varchar('user_name', { length: 200 }),
    method: varchar('method', { length: 10 }),
    path: text('path'),
    /** HTTP response status; null for rows written before the column existed. */
    statusCode: integer('status_code'),
    body: text('body'),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
