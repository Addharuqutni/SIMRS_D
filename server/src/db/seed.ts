import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { auth } from './auth';
import { medicines } from './schemas/inventory';
import { doctorSchedules } from './schemas/schedule';
import { icd10Codes } from './schemas/icd10';
import { icd9Codes } from './schemas/icd9';
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

    // 4. Seed ICD-10 Diagnosis Codes (idempotent — existing codes are skipped)
    const icd10List = [
        { code: 'A91', description: 'Demam berdarah dengue (DBD)', category: 'Infeksi' },
        { code: 'A97', description: 'Demam dengue', category: 'Infeksi' },
        { code: 'A01.0', description: 'Demam tifoid', category: 'Infeksi' },
        { code: 'A15.0', description: 'Tuberkulosis paru', category: 'Infeksi' },
        { code: 'A09', description: 'Diare akut infeksi', category: 'Infeksi' },
        { code: 'B01', description: 'Varisela (cacar air)', category: 'Infeksi' },
        { code: 'B05', description: 'Morbili (campak)', category: 'Infeksi' },
        { code: 'B16', description: 'Hepatitis B akut', category: 'Infeksi' },
        { code: 'B54', description: 'Malaria tanpa spesifikasi', category: 'Infeksi' },
        { code: 'B86', description: 'Skabies', category: 'Infeksi' },
        { code: 'B34.9', description: 'Infeksi virus tanpa spesifikasi', category: 'Infeksi' },
        { code: 'D50', description: 'Anemia defisiensi besi', category: 'Hematologi' },
        { code: 'D64.9', description: 'Anemia tanpa spesifikasi', category: 'Hematologi' },
        { code: 'E03.9', description: 'Hipotiroidisme', category: 'Endokrin & Metabolik' },
        { code: 'E11', description: 'Diabetes melitus tipe 2', category: 'Endokrin & Metabolik' },
        { code: 'E66.9', description: 'Obesitas', category: 'Endokrin & Metabolik' },
        { code: 'E78.5', description: 'Dislipidemia (hiperlipidemia)', category: 'Endokrin & Metabolik' },
        { code: 'E86', description: 'Dehidrasi', category: 'Endokrin & Metabolik' },
        { code: 'H10.9', description: 'Konjungtivitis', category: 'Mata' },
        { code: 'H66.9', description: 'Otitis media', category: 'THT' },
        { code: 'I10', description: 'Hipertensi esensial (primer)', category: 'Kardiovaskular' },
        { code: 'I25', description: 'Penyakit jantung iskemik kronis (PJK)', category: 'Kardiovaskular' },
        { code: 'I50', description: 'Gagal jantung kongestif', category: 'Kardiovaskular' },
        { code: 'I63', description: 'Stroke iskemik (infark serebral)', category: 'Neurologi' },
        { code: 'I64', description: 'Stroke non-hemoragik', category: 'Neurologi' },
        { code: 'J02.9', description: 'Faringitis akut', category: 'THT' },
        { code: 'J03.9', description: 'Tonsilitis akut', category: 'THT' },
        { code: 'J06.9', description: 'Infeksi saluran pernapasan akut (ISPA)', category: 'Paru' },
        { code: 'J18.9', description: 'Pneumonia', category: 'Paru' },
        { code: 'J20.9', description: 'Bronkitis akut', category: 'Paru' },
        { code: 'J30.4', description: 'Rinitis alergika', category: 'Paru' },
        { code: 'J44', description: 'Penyakit paru obstruktif kronik (PPOK)', category: 'Paru' },
        { code: 'J45', description: 'Asma', category: 'Paru' },
        { code: 'K02.9', description: 'Karies gigi', category: 'Gigi' },
        { code: 'K04.9', description: 'Penyakit pulpa gigi', category: 'Gigi' },
        { code: 'K29.7', description: 'Gastritis', category: 'Pencernaan' },
        { code: 'K35.80', description: 'Apendisitis akut', category: 'Pencernaan' },
        { code: 'K40.9', description: 'Hernia inguinalis', category: 'Pencernaan' },
        { code: 'K52.9', description: 'Gastroenteritis noninfeksi', category: 'Pencernaan' },
        { code: 'K80.2', description: 'Kolelitiasis tanpa kolesistitis (batu kandung empedu)', category: 'Pencernaan' },
        { code: 'L01.0', description: 'Impetigo', category: 'Kulit' },
        { code: 'L50', description: 'Urtikaria', category: 'Kulit' },
        { code: 'M17', description: 'Osteoartritis lutut (gonartrosis)', category: 'Muskuloskeletal' },
        { code: 'M54.5', description: 'Nyeri punggung bawah', category: 'Muskuloskeletal' },
        { code: 'N18.9', description: 'Penyakit ginjal kronik (PGK)', category: 'Urologi' },
        { code: 'N20.0', description: 'Batu ginjal', category: 'Urologi' },
        { code: 'N23', description: 'Kolik nefretik', category: 'Urologi' },
        { code: 'N39.0', description: 'Infeksi saluran kemih (ISK)', category: 'Urologi' },
        { code: 'N40', description: 'Hiperplasia prostat jinak (BPH)', category: 'Urologi' },
        { code: 'N70.9', description: 'Penyakit radang panggul', category: 'Obstetri & Ginekologi' },
        { code: 'N80.9', description: 'Endometriosis', category: 'Obstetri & Ginekologi' },
        { code: 'O21.0', description: 'Hiperemesis gravidarum', category: 'Obstetri & Ginekologi' },
        { code: 'O26.9', description: 'Supervisi kehamilan', category: 'Obstetri & Ginekologi' },
        { code: 'O36.5', description: 'Supervisi kehamilan karena pertumbuhan janin terhambat', category: 'Obstetri & Ginekologi' },
        { code: 'O80', description: 'Persalinan spontan normal', category: 'Obstetri & Ginekologi' },
        { code: 'P07.1', description: 'Berat lahir rendah (BBLR)', category: 'Neonatal' },
        { code: 'P21.0', description: 'Asfiksia lahir', category: 'Neonatal' },
        { code: 'P36.9', description: 'Sepsis bakteri neonatus (sepsis neonatorum)', category: 'Neonatal' },
        { code: 'P59.9', description: 'Ikterus neonatal', category: 'Neonatal' },
        { code: 'R05', description: 'Batuk', category: 'Gejala & Tanda' },
        { code: 'R10.4', description: 'Nyeri perut', category: 'Gejala & Tanda' },
        { code: 'R50.9', description: 'Demam', category: 'Gejala & Tanda' },
        { code: 'R51', description: 'Sakit kepala', category: 'Gejala & Tanda' },
        { code: 'Z00.0', description: 'Pemeriksaan kesehatan umum', category: 'Non-Penyakit' },
    ];

    for (const icd of icd10List) {
        await db.insert(icd10Codes).values(icd).onConflictDoNothing();
    }
    console.log('✅ Seeded ICD-10 codes');

    // 5. Seed ICD-9-CM Procedure Codes (idempotent — existing codes are skipped)
    const icd9List = [
        { code: '47.01', description: 'Apendektomi laparoskopi', category: 'Bedah Digestif' },
        { code: '47.09', description: 'Apendektomi terbuka (lainnya)', category: 'Bedah Digestif' },
        { code: '51.10', description: 'ERCP (pemeriksaan retrograd pankreatikobilier)', category: 'Bedah Digestif' },
        { code: '51.22', description: 'Kolesistektomi terbuka', category: 'Bedah Digestif' },
        { code: '51.23', description: 'Kolesistektomi laparoskopi', category: 'Bedah Digestif' },
        { code: '46.10', description: 'Kolostomi', category: 'Bedah Digestif' },
        { code: '49.46', description: 'Hemoroidektomi', category: 'Bedah Digestif' },
        { code: '54.11', description: 'Laparotomi eksplorasi', category: 'Bedah Umum' },
        { code: '54.21', description: 'Laparoskopi diagnostik', category: 'Bedah Umum' },
        { code: '53.00', description: 'Herniorafi hernia inguinalis direk (unilateral)', category: 'Bedah Umum' },
        { code: '53.01', description: 'Herniorafi hernia inguinalis indirek (unilateral)', category: 'Bedah Umum' },
        { code: '44.13', description: 'Endoskopi saluran cerna atas (EGD)', category: 'Bedah Digestif' },
        { code: '74.1', description: 'Sectio caesarea (insisi servikal bawah)', category: 'Obstetri' },
        { code: '72.79', description: 'Persalinan dengan ekstraksi vakum', category: 'Obstetri' },
        { code: '73.59', description: 'Persalinan dengan bantuan manual', category: 'Obstetri' },
        { code: '73.6', description: 'Episiotomi', category: 'Obstetri' },
        { code: '75.4', description: 'Pengeluaran plasenta secara manual', category: 'Obstetri' },
        { code: '66.39', description: 'Tubektomi (ligasi tuba falopii bilateral)', category: 'Ginekologi' },
        { code: '68.4', description: 'Histerektomi total abdominal', category: 'Ginekologi' },
        { code: '69.02', description: 'Kuretase (D&C) pasca abortus', category: 'Ginekologi' },
        { code: '69.59', description: 'Kuretase uterus (lainnya)', category: 'Ginekologi' },
        { code: '69.7', description: 'Pemasangan IUD / AKDR', category: 'Ginekologi' },
        { code: '85.41', description: 'Mastektomi simpleks', category: 'Bedah Onkologi' },
        { code: '60.21', description: 'Prostatektomi transuretral (TURP)', category: 'Urologi' },
        { code: '60.29', description: 'Prostatektomi terbuka (lainnya)', category: 'Urologi' },
        { code: '64.5', description: 'Sirkumsisi (sunat)', category: 'Urologi' },
        { code: '57.32', description: 'Sitoskopi', category: 'Urologi' },
        { code: '57.94', description: 'Pemasangan kateter urin menetap', category: 'Urologi' },
        { code: '98.51', description: 'Litotripsi gelombang kejut ekstrakorporeal (ESWL)', category: 'Urologi' },
        { code: '79.00', description: 'Reduksi tertutup fraktur tanpa fiksasi internal', category: 'Ortopedi' },
        { code: '79.60', description: 'Reduksi terbuka fraktur dengan fiksasi internal (ORIF)', category: 'Ortopedi' },
        { code: '80.26', description: 'Artroskopi lutut', category: 'Ortopedi' },
        { code: '81.51', description: 'Artroplasti panggul total (penggantian sendi pinggul)', category: 'Ortopedi' },
        { code: '81.54', description: 'Artroplasti lutut total (penggantian sendi lutut)', category: 'Ortopedi' },
        { code: '86.04', description: 'Insisi dan drainase abses kulit', category: 'Kulit & Jaringan Lunak' },
        { code: '86.22', description: 'Debridemen luka (eksisional)', category: 'Kulit & Jaringan Lunak' },
        { code: '86.59', description: 'Penjahitan luka kulit dan jaringan subkutan', category: 'Kulit & Jaringan Lunak' },
        { code: '86.69', description: 'Cangkok kulit (skin graft)', category: 'Kulit & Jaringan Lunak' },
        { code: '31.29', description: 'Trakeostomi', category: 'Kepala & Leher' },
        { code: '87.03', description: 'CT scan kepala', category: 'Radiologi' },
        { code: '88.76', description: 'USG abdomen', category: 'Radiologi' },
        { code: '39.95', description: 'Hemodialisis', category: 'Terapi & Prosedur Khusus' },
        { code: '96.04', description: 'Intubasi endotrakeal', category: 'Terapi & Prosedur Khusus' },
        { code: '99.04', description: 'Transfusi darah', category: 'Terapi & Prosedur Khusus' },
    ];

    for (const icd of icd9List) {
        await db.insert(icd9Codes).values(icd).onConflictDoNothing();
    }
    console.log('✅ Seeded ICD-9-CM procedure codes');

    console.log('Seeding complete! 🎉');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Error seeding database:', err);
    process.exit(1);
});
