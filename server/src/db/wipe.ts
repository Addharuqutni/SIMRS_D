import { db } from './index';
import { sql } from 'drizzle-orm';

async function wipeDatabase() {
    console.log('🧹 Preparing to wipe all database records...');

    try {
        console.log('Executing TRUNCATE TABLE ... CASCADE...');
        // Truncate all tables and reset identity (auto-increment counters)
        await db.execute(sql`
            TRUNCATE TABLE 
                medicines, stock_batches, stock_mutations,
                doctor_schedules, queues,
                patients, visits, igd_triase, emr_soap, rawat_inap_admisi
            RESTART IDENTITY CASCADE;
        `);

        console.log('✅ All data has been successfully wiped and sequences reset. Database is clean.');
    } catch (error) {
        console.error('❌ Error wiping database:', error);
    } finally {
        process.exit(0);
    }
}

wipeDatabase();
