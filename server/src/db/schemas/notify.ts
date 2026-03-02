import { pgTable, serial, varchar, integer, timestamp, boolean, text } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const notifications = pgTable('notifications', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id), // If null, it's a broadcast
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 20 }).notNull().default('info'), // info, success, warning, error
    isRead: boolean('is_read').notNull().default(false),
    linkUrl: varchar('link_url', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
