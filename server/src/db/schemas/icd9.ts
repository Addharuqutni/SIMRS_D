import { pgTable, text, varchar } from 'drizzle-orm/pg-core';

// ICD-9-CM procedure reference table (seeded, read-only from the app side)
export const icd9Codes = pgTable('icd9_codes', {
    code: varchar('code', { length: 10 }).primaryKey(),
    description: text('description').notNull(),
    category: varchar('category', { length: 100 }),
});
