import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schemas';

/**
 * Driver-agnostic database handle. Production passes the node-postgres `db`;
 * tests pass a PGlite-backed instance from `db/testing.ts`. Domain modules
 * accept this type instead of importing the singleton.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A `Db` or an open transaction on one; both expose the same query surface. */
export type DbOrTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
