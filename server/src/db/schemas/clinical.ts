import { pgTable, text, timestamp, varchar, real, integer } from 'drizzle-orm/pg-core';
import { visits } from './patient';
import { users } from './auth';

/**
 * EMR SOAP — initial assessment note per visit (kept for backward compat).
 * For ongoing progress notes see `emrProgressNotes` (CPPT) below.
 */
export const emrSoap = pgTable('emr_soap', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    dokterId: text('dokter_id').notNull(),
    subjektif: text('subjektif'),
    objektif: text('objektif'),
    asesmen: text('asesmen'),
    planning: text('planning'),
    icd10Codes: text('icd10_codes').default('[]'), // JSON string array of ICD-10 codes
    icd9Codes: text('icd9_codes').default('[]'), // JSON string array of ICD-9-CM procedure codes
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Vital Signs — numeric, structured observations. Multiple records per visit
 * enable trending and early-warning score (MEWS/NEWS2) calculation.
 * Systolic/diastolic stored separately to allow precise BP trending.
 */
export const vitalSigns = pgTable('vital_signs', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    // Author of the observation (dokter or perawat)
    recordedBy: text('recorded_by').notNull().references(() => users.id),
    // Blood pressure (mmHg)
    sistolik: integer('sistolik'),
    diastolik: integer('diastolik'),
    // Heart rate (bpm)
    nadi: integer('nadi'),
    // Temperature (°C) — real allows decimals (e.g. 37.5)
    suhu: real('suhu'),
    // Respiratory rate (breaths/min)
    pernapasan: integer('pernapasan'),
    // Oxygen saturation (%)
    spo2: integer('spo2'),
    // Body measurements
    beratBadan: real('berat_badan'), // kg
    tinggiBadan: real('tinggi_badan'), // cm
    // Glasgow Coma Scale (3-15)
    gcs: integer('gcs'),
    // Auto-computed MEWS score (0-15) — higher = more critical
    mewsScore: integer('mews_score'),
    // Free-text note (e.g. "Pasien tampak sakit berat")
    catatan: text('catatan'),
    // Penyelenggara: "Dokter" | "Perawat" | "Analis" — role context
    penyelenggara: varchar('penyelenggara', { length: 50 }).default('Perawat'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * CPPT — Catatan Perkembangan Pasien Terintegrasi.
 * Multiple progress notes per visit (one per encounter/author).
 * Required for KARS accreditation. Replaces the "single SOAP per visit" model
 * with a longitudinal timeline authored by doctors and nurses.
 */
export const emrProgressNotes = pgTable('emr_progress_notes', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    authorId: text('author_id').notNull().references(() => users.id),
    authorRole: varchar('author_role', { length: 30 }).notNull(), // 'Dokter' | 'Perawat'
    subjektif: text('subjektif'),
    objektif: text('objektif'),
    asesmen: text('asesmen'),
    planning: text('planning'),
    icd10Codes: text('icd10_codes').default('[]'),
    icd9Codes: text('icd9_codes').default('[]'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    // Soft-delete for audit retention (never hard-delete clinical notes)
    deletedAt: timestamp('deleted_at'),
});

export const igdTriase = pgTable('igd_triase', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    triase: varchar('triase', { length: 20 }).notNull(), // merah, kuning, hijau, hitam
    keluhanUtama: text('keluhan_utama').notNull(),
    // Vital signs moved to numeric fields (was varchar). Supports trending & MEWS.
    sistolik: integer('sistolik'),
    diastolik: integer('diastolik'),
    nadi: integer('nadi'),
    suhu: real('suhu'),
    pernapasan: integer('pernapasan'),
    spo2: integer('spo2'),
    kesadaran: varchar('kesadaran', { length: 50 }),
    // Auto-computed MEWS at triage time
    mewsScore: integer('mews_score'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rawatInapAdmisi = pgTable('rawat_inap_admisi', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    ruanganId: text('ruangan_id').notNull(),
    kelas: varchar('kelas', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('dirawat'), // dirawat, kritis, rencana_pulang, pulang
    waktuMasuk: timestamp('waktu_masuk').defaultNow().notNull(),
    waktuKeluar: timestamp('waktu_keluar'),
});

export const labOrders = pgTable('lab_orders', {
    id: text('id').primaryKey(), // Generated ID like LAB-001
    visitId: text('visit_id').notNull().references(() => visits.id),
    dokterId: text('dokter_id').notNull(),
    jenisPemeriksaan: text('jenis_pemeriksaan').notNull(), // Asam Urat, Gula Darah, dsb
    catatan: text('catatan'),
    status: varchar('status', { length: 20 }).notNull().default('menunggu'), // menunggu, diproses, selesai
    hasilUrl: text('hasil_url'), // PDF/Image URL if any
    hasilTeks: text('hasil_teks'),
    waktuOrder: timestamp('waktu_order').defaultNow().notNull(),
    waktuSelesai: timestamp('waktu_selesai'),
});

export const radiologyOrders = pgTable('radiology_orders', {
    id: text('id').primaryKey(), // Generated ID like RAD-001
    visitId: text('visit_id').notNull().references(() => visits.id),
    dokterId: text('dokter_id').notNull(),
    jenisPemeriksaan: text('jenis_pemeriksaan').notNull(), // Rontgen Thorax, USG, dsb
    catatan: text('catatan'),
    status: varchar('status', { length: 20 }).notNull().default('menunggu'), // menunggu, diproses, selesai
    hasilDicomUrl: text('hasil_dicom_url'), // Link to image
    expertise: text('expertise'), // Doctor's note on the scan
    waktuOrder: timestamp('waktu_order').defaultNow().notNull(),
    waktuSelesai: timestamp('waktu_selesai'),
});
