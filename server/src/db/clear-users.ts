import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixSchema() {
    // Drop dependent tables first
    await pool.query('DELETE FROM doctor_schedules');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM accounts');
    await pool.query('DELETE FROM verifications');
    await pool.query('DELETE FROM users');

    // Change emailVerified from timestamp to boolean
    await pool.query('ALTER TABLE users ALTER COLUMN "emailVerified" TYPE boolean USING CASE WHEN "emailVerified" IS NOT NULL THEN true ELSE false END');

    console.log('✅ Fixed schema and cleared all tables');
    pool.end();
}

fixSchema().catch(console.error);
