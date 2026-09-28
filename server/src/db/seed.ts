/**
 * Database seed.
 *
 * The file is split so it can run against ANY `Db`:
 *   - `seedReferenceData(db, doctorId)` — medicines, schedules, ICD-10/9, settings;
 *   - `seedDemoData(db, ids)`           — a day of hospital activity, built by
 *     calling the domain modules (admission, pharmacy dispensing, penunjang
 *     orders, SEP issuance, billing ledger) instead of hand-writing rows, so
 *     every invariant the app enforces also holds for seeded data;
 *   - `seedDatabase(db, ids)`           — the two above, in order;
 *   - the CLI entry at the bottom creates the better-auth users (hashed
 *     passwords) and then calls `seedDatabase` with the real pool db.
 *
 * Tests import the builder functions and run them on an in-memory PGlite.
 */
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Db } from './types';
import { auth } from './auth';
import { users } from './schemas/auth';
import { medicines } from './schemas/inventory';
import { doctorSchedules } from './schemas/schedule';
import { settings } from './schemas/settings';
import { icd10Codes } from './schemas/icd10';
import { icd9Codes } from './schemas/icd9';
import { visits } from './schemas/patient';
import { admit } from '../modules/admission/admission';
import { createResep, dispense, startProses } from '../modules/pharmacy/dispensing';
import { receiveBatch } from '../modules/inventory/stock';
import { createOrder } from '../modules/penunjang/orders';
import { finalize, pay } from '../modules/billing/ledger';
import { issueSep } from '../modules/vclaim/sep-klaim';
import { FakeVClaimAdapter } from '../modules/vclaim/fake-adapter';
import { DEFAULT_ROOM_TARIFF, DEFAULT_SERVICE_TARIFF } from '../../../shared/tariff';

// ─── Seed definitions ───────────────────────────────────────────────────────

export interface SeedUserSpec {
    /** Stable key other seed steps refer to (`ids[user.key]`). */
    key: 'admin' | 'dokter' | 'perawat' | 'apoteker' | 'kasir';
    name: string;
    email: string;
    password: string;
    role: string;
    unit: string;
}

/** Demo accounts — documented in README "Akun Demo". */
export const SEED_USERS: readonly SeedUserSpec[] = [
    { key: 'admin', name: 'Administrator', email: 'admin@simrs.com', password: 'admin123!', role: 'Superadmin', unit: 'IT' },
    { key: 'dokter', name: 'Dr. Andi, Sp.B', email: 'dokter@simrs.com', password: 'dokter123!', role: 'Dokter Spesialis', unit: 'Poli Bedah' },
    { key: 'perawat', name: 'Ns. Siti, S.Kep', email: 'perawat@simrs.com', password: 'perawat123!', role: 'Perawat', unit: 'IGD' },
    { key: 'apoteker', name: 'Budi, S.Farm, Apt', email: 'farmasi@simrs.com', password: 'farmasi123!', role: 'Apoteker', unit: 'Farmasi' },
    { key: 'kasir', name: 'Rina', email: 'kasir@simrs.com', password: 'kasir123!', role: 'Kasir / Billing', unit: 'Keuangan' },
];

/** ids resolved by the caller (better-auth in production, direct inserts in tests). */
export type SeedUserIds = Record<SeedUserSpec['key'], string>;

export const MEDICINE_SEED = [
    { kodeObat: 'OBT-001', nama: 'Paracetamol 500mg', kategori: 'Tablet', satuan: 'Strip', hargaBeli: 2500, hargaJual: 3500, minStok: 50 },
    { kodeObat: 'OBT-002', nama: 'Amoxicillin 500mg', kategori: 'Kapsul', satuan: 'Strip', hargaBeli: 5000, hargaJual: 7500, minStok: 30 },
    { kodeObat: 'OBT-003', nama: 'Ibuprofen 400mg', kategori: 'Tablet', satuan: 'Strip', hargaBeli: 3000, hargaJual: 4500, minStok: 40 },
    { kodeObat: 'OBT-004', nama: 'Omeprazole 20mg', kategori: 'Kapsul', satuan: 'Strip', hargaBeli: 7000, hargaJual: 10000, minStok: 25 },
    { kodeObat: 'OBT-005', nama: 'Sirup Obat Batuk Hitam', kategori: 'Cair', satuan: 'Botol', hargaBeli: 12000, hargaJual: 18000, minStok: 15 },
    { kodeObat: 'OBT-006', nama: 'Vitamin C 1000mg', kategori: 'Tablet Effervescent', satuan: 'Tube', hargaBeli: 35000, hargaJual: 45000, minStok: 20 },
];

export const SCHEDULE_SEED = [
    { poliId: 'Poli Bedah', dayOfWeek: 1, startTime: '08:00', endTime: '12:00', quota: 20 },
    { poliId: 'Poli Umum', dayOfWeek: 2, startTime: '13:00', endTime: '16:00', quota: 15 },
];

export const ICD10_SEED = [
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

export const ICD9_SEED = [
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

/** Settings rows written by the seed (idempotent upsert by key). */
export const SETTINGS_SEED: Record<string, string> = {
    namaRS: 'RS SIMRS Tipe D',
    alamatRS: 'Jl. Kesehatan No. 1, Jakarta',
    jamLayanan: '24 Jam',
    tarifKamar: JSON.stringify(DEFAULT_ROOM_TARIFF),
    tarifLayanan: JSON.stringify(DEFAULT_SERVICE_TARIFF),
};

// ─── Reference data ─────────────────────────────────────────────────────────

/** Medicies, schedules, ICD catalogs and settings — all idempotent. */
export async function seedReferenceData(db: Db, doctorId: string | null): Promise<void> {
    for (const obat of MEDICINE_SEED) {
        await db.insert(medicines).values(obat).onConflictDoNothing();
    }

    if (doctorId) {
        for (const schedule of SCHEDULE_SEED) {
            await db.insert(doctorSchedules).values({ ...schedule, doctorId }).onConflictDoNothing();
        }
    }

    for (const icd of ICD10_SEED) {
        await db.insert(icd10Codes).values(icd).onConflictDoNothing();
    }
    for (const icd of ICD9_SEED) {
        await db.insert(icd9Codes).values(icd).onConflictDoNothing();
    }

    for (const [key, value] of Object.entries(SETTINGS_SEED)) {
        await db.insert(settings)
            .values({ key, value })
            .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    }
}

// ─── Demo service data (through the domain modules) ─────────────────────────

/**
 * One day of hospital activity. Every row is produced by the module that owns
 * that table, so seeded data obeys the same invariants as live data:
 * admission (RM issued by the server), pharmacy dispensing (FEFO stock +
 * charge), penunjang orders (charge at tariff), SEP issuance (fake adapter in
 * dev = 'simulasi' source) and the billing ledger (finalize + pay).
 *
 * Idempotent: skips when the database already has Kunjungan rows.
 */
export async function seedDemoData(db: Db, ids: SeedUserIds): Promise<boolean> {
    const [existing] = await db.select({ id: visits.id }).from(visits).limit(1);
    if (existing) return false;

    // Stock must exist before anything can be dispensed (FEFO).
    const [paracetamol] = await db.select().from(medicines).where(eq(medicines.kodeObat, 'OBT-001'));
    const [amoxicillin] = await db.select().from(medicines).where(eq(medicines.kodeObat, 'OBT-002'));
    if (paracetamol) {
        await receiveBatch(db, {
            medicineId: paracetamol.id, noBatch: 'BATCH-PCM-01', expiredDate: '2028-12-31',
            qty: 200, supplier: 'PT Kimia Farma', noFaktur: 'INV-PCM-2026-01', hargaBeli: 2500,
        });
    }
    if (amoxicillin) {
        await receiveBatch(db, {
            medicineId: amoxicillin.id, noBatch: 'BATCH-AMX-01', expiredDate: '2028-06-30',
            qty: 120, supplier: 'PT Kimia Farma', noFaktur: 'INV-AMX-2026-01', hargaBeli: 5000,
        });
    }

    // ── BPJS rawat jalan: SEP issued first (sumber 'simulasi'), then dispensed.
    const bpjs = await admit(db, {
        jenis: 'rawat_jalan',
        poliId: 'Poli Umum',
        dokterId: ids.dokter,
        jaminan: 'BPJS Kesehatan',
        pasienBaru: {
            nama: 'Budi Santoso', gender: 'L', nik: '3171010101800001',
            tanggalLahir: '1980-01-01', alamat: 'Jl. Melati No. 10, Jakarta', telepon: '081234567890',
            goldar: 'O', agama: 'Islam',
        },
    });

    await issueSep(db, new FakeVClaimAdapter({ namaPeserta: 'Budi Santoso' }), {
        visitId: bpjs.visit.id,
        noKartu: '0001234567890',
        diagnosa: 'J06.9 - ISPA',
        ppkRujukan: 'Puskesmas Kecamatan Melati',
    });

    await createOrder(db, 'lab', {
        visitId: bpjs.visit.id, dokterId: ids.dokter,
        jenisPemeriksaan: 'Darah Lengkap', catatan: 'Order dari seed',
    });

    if (paracetamol && amoxicillin) {
        const resep = await createResep(db, {
            visitId: bpjs.visit.id, dokterId: ids.dokter,
            items: [
                { obatId: paracetamol.id, dosis: '3 x sehari 1 tablet', jumlah: 1, keterangan: 'Setelah makan' },
                { obatId: amoxicillin.id, dosis: '3 x sehari 1 kapsul', jumlah: 1, keterangan: 'Habiskan' },
            ],
        });
        await startProses(db, resep.id);
        await dispense(db, resep.id, 'Budi, S.Farm, Apt');
    }

    // ── Mandiri rawat jalan: settle end to end so Laporan Keuangan has data.
    const mandiri = await admit(db, {
        jenis: 'rawat_jalan',
        poliId: 'Poli Gigi',
        dokterId: ids.dokter,
        jaminan: 'Umum / Mandiri',
        pasienBaru: { nama: 'Siti Aminah', gender: 'P', nik: '3171010202900002', tanggalLahir: '1990-02-02' },
    });

    await createOrder(db, 'radiologi', {
        visitId: mandiri.visit.id, dokterId: ids.dokter,
        jenisPemeriksaan: 'Rontgen Thorax', catatan: 'Order dari seed',
    });

    const bill = await finalize(db, mandiri.visit.id);
    await pay(db, bill.id, 'tunai', ids.kasir);

    return true;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export async function seedDatabase(db: Db, ids: SeedUserIds): Promise<void> {
    await seedReferenceData(db, ids.dokter);
    const seeded = await seedDemoData(db, ids);
    if (!seeded) console.log('⏭️  Demo kunjungan sudah ada — dilewati (jalankan db:wipe untuk menyegarkan).');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

export function createPoolDb(connectionString = process.env.DATABASE_URL): Db {
    const pool = new Pool({ connectionString });
    return drizzle(pool) as unknown as Db;
}

/** Creates the demo users through better-auth (hashed passwords) and returns their ids. */
export async function createSeedUsers(db: Db): Promise<SeedUserIds> {
    const ids = {} as SeedUserIds;

    for (const spec of SEED_USERS) {
        try {
            const ctx = await auth.api.signUpEmail({
                body: { name: spec.name, email: spec.email, password: spec.password },
            });
            if (ctx?.user?.id) {
                await db.update(users).set({ role: spec.role, unit: spec.unit, status: 'aktif' }).where(eq(users.id, ctx.user.id));
                ids[spec.key] = ctx.user.id;
                console.log(`  ✅ Pengguna dibuat: ${spec.email}`);
                continue;
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            const body = (error as { body?: { code?: string } }).body;
            if (!message.includes('already') && body?.code !== 'USER_ALREADY_EXISTS') {
                console.log(`  ⚠️  Gagal membuat ${spec.email}: ${message}`);
            }
        }

        // Already registered on an earlier run — reuse the existing row.
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, spec.email)).limit(1);
        if (existing) {
            ids[spec.key] = existing.id;
            console.log(`  ⏭️  Pengguna sudah ada: ${spec.email}`);
        } else {
            throw new Error(`Pengguna ${spec.email} tidak dapat dibuat maupun ditemukan.`);
        }
    }

    return ids;
}

async function main(): Promise<void> {
    dotenv.config();
    console.log('Seeding database...');

    const db = createPoolDb();
    const ids = await createSeedUsers(db);
    console.log('✅ Seeded users');

    await seedReferenceData(db, ids.dokter);
    console.log('✅ Seeded medicines, schedules, ICD-10/9 and settings');

    const seeded = await seedDemoData(db, ids);
    console.log(seeded ? '✅ Seeded demo kunjungan, resep & billing' : '⏭️  Demo kunjungan sudah ada — dilewati');

    console.log('Seeding complete! 🎉');
}

// Only run as a CLI (`tsx src/db/seed.ts`), never when imported by a test.
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((err: unknown) => {
            console.error('Error seeding database:', err);
            process.exit(1);
        });
}
