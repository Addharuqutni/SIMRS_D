import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { auth } from './auth';
import { medicines } from './schemas/inventory';
import { doctorSchedules } from './schemas/schedule';
import { users } from './schemas/auth';
import { eq } from 'drizzle-orm';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function seed() {
    console.log('Seeding database...');

    // 1. Seed Users via Better Auth signUp API (creates both user + account with hashed pw)
    const masterUsers = [
        { name: 'Administrator', email: 'admin@simrs.com', password: 'admin123!', role: 'Superadmin', unit: 'IT' },
        { name: 'Dr. Andi, Sp.B', email: 'dokter@simrs.com', password: 'dokter123!', role: 'Dokter Spesialis', unit: 'Poli Bedah' },
        { name: 'Ns. Siti, S.Kep', email: 'perawat@simrs.com', password: 'perawat123!', role: 'Perawat', unit: 'IGD' },
        { name: 'Budi, S.Farm, Apt', email: 'farmasi@simrs.com', password: 'farmasi123!', role: 'Apoteker', unit: 'Farmasi' },
        { name: 'Rina', email: 'kasir@simrs.com', password: 'kasir123!', role: 'Kasir / Billing', unit: 'Keuangan' },
    ];

    const createdUserIds: Record<string, string> = {};

    for (const u of masterUsers) {
        try {
            const ctx = await auth.api.signUpEmail({
                body: {
                    name: u.name,
                    email: u.email,
                    password: u.password,
                },
            });

            if (ctx?.user?.id) {
                createdUserIds[u.email] = ctx.user.id;
                await db.update(users)
                    .set({ role: u.role, unit: u.unit, status: 'aktif' })
                    .where(eq(users.id, ctx.user.id));
            }

            console.log(`  ✅ Created user: ${u.email}`);
        } catch (error: unknown) {
            const err = error as any;
            if (err?.message?.includes('already') || err?.body?.code === 'USER_ALREADY_EXISTS') {
                console.log(`  ⏭️  User already exists: ${u.email}`);
            } else {
                console.log(`  ⚠️  Error creating ${u.email}:`, err?.message || err);
            }
        }
    }
    console.log('✅ Seeded users');

    // 2. Seed Medicines
    const obatList = [
        { kodeObat: 'OBT-001', nama: 'Paracetamol 500mg', kategori: 'Tablet', satuan: 'Strip', hargaBeli: 2500, hargaJual: 3500, minStok: 50 },
        { kodeObat: 'OBT-002', nama: 'Amoxicillin 500mg', kategori: 'Kapsul', satuan: 'Strip', hargaBeli: 5000, hargaJual: 7500, minStok: 30 },
        { kodeObat: 'OBT-003', nama: 'Ibuprofen 400mg', kategori: 'Tablet', satuan: 'Strip', hargaBeli: 3000, hargaJual: 4500, minStok: 40 },
        { kodeObat: 'OBT-004', nama: 'Omeprazole 20mg', kategori: 'Kapsul', satuan: 'Strip', hargaBeli: 7000, hargaJual: 10000, minStok: 25 },
        { kodeObat: 'OBT-005', nama: 'Sirup Obat Batuk Hitam', kategori: 'Cair', satuan: 'Botol', hargaBeli: 12000, hargaJual: 18000, minStok: 15 },
        { kodeObat: 'OBT-006', nama: 'Vitamin C 1000mg', kategori: 'Tablet Effervescent', satuan: 'Tube', hargaBeli: 35000, hargaJual: 45000, minStok: 20 }
    ];

    for (const obat of obatList) {
        await db.insert(medicines).values(obat).onConflictDoNothing();
    }
    console.log('✅ Seeded medicines');

    // 3. Seed Doctor Schedules (only if doctor was created)
    const doctorId = createdUserIds['dokter@simrs.com'];
    if (doctorId) {
        const schedules = [
            { doctorId, poliId: 'Poli Bedah', dayOfWeek: 1, startTime: '08:00', endTime: '12:00', quota: 20 },
            { doctorId, poliId: 'Poli Umum', dayOfWeek: 2, startTime: '13:00', endTime: '16:00', quota: 15 },
        ];

        for (const schedule of schedules) {
            await db.insert(doctorSchedules).values(schedule).onConflictDoNothing();
        }
        console.log('✅ Seeded doctor schedules');
    } else {
        console.log('⏭️  Skipping doctor schedules (doctor user not found)');
    }

    console.log('Seeding complete! 🎉');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Error seeding database:', err);
    process.exit(1);
});
