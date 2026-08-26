import { pgTable, text, varchar } from 'drizzle-orm/pg-core';

// ICD-10 diagnosis reference table (seeded, read-only from the app side)
export const icd10Codes = pgTable('icd10_codes', {
    code: varchar('code', { length: 10 }).primaryKey(),
    description: text('description').notNull(),
    category: varchar('category', { length: 100 }),
});
