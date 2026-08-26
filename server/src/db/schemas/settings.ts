import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// Simple key-value store for system settings (profil RS, tarif kamar, dll).
export const settings = pgTable('settings', {
    key: varchar('key', { length: 100 }).primaryKey(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
