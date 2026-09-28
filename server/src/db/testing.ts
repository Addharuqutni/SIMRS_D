/**
 * In-memory Postgres (PGlite) for module tests. Builds the schema straight from
 * the Drizzle table definitions, so tests never depend on a stale migration.
 * Test-only: never import from production code.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schemas';
import * as settingsSchema from './schemas/settings';
import * as icd10Schema from './schemas/icd10';
import * as icd9Schema from './schemas/icd9';
import type { Db } from './types';

const allTables = { ...schema, ...settingsSchema, ...icd10Schema, ...icd9Schema };

export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
    // drizzle-kit/api is CJS-heavy; require lazily so only tests pay for it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateDrizzleJson, generateMigration } = require('drizzle-kit/api');
    const client = new PGlite();
    const db = drizzle(client, { schema }) as unknown as Db;
    const statements: string[] = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(allTables));
    for (const sql of statements) await client.exec(sql);
    return { db, close: () => client.close() };
}
