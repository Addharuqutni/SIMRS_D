/**
 * Destructive utility: TRUNCATE every table declared in `db/schemas`, CASCADE,
 * resetting identity counters. The table list is derived from the Drizzle
 * exports, so adding a schema file automatically includes its tables here.
 *
 *   npm run db:wipe        (dev/local only — refuses to run in production)
 */
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { db } from './index';
import * as schema from './schemas';
import * as settingsSchema from './schemas/settings';
import * as icd10Schema from './schemas/icd10';
import * as icd9Schema from './schemas/icd9';

const schemaModules = { ...schema, ...settingsSchema, ...icd10Schema, ...icd9Schema };

/** Every Drizzle table exported by the schema modules, in a stable order. */
export function listTables(): string[] {
    const names = new Set<string>();
    for (const value of Object.values(schemaModules)) {
        if (is(value, PgTable)) names.add(getTableName(value));
    }
    return [...names].sort();
}

async function wipeDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ db:wipe menolak berjalan saat NODE_ENV=production.');
        process.exitCode = 1;
        return;
    }

    const tables = listTables();
    console.log(`🧹 Wiping ${tables.length} tables: ${tables.join(', ')}`);

    const list = tables.map((t) => `"${t}"`).join(', ');
    await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`));

    console.log('✅ All data has been wiped and identity sequences reset.');
}

wipeDatabase()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error: unknown) => {
        console.error('❌ Error wiping database:', error instanceof Error ? error.message : error);
        process.exit(1);
    });
