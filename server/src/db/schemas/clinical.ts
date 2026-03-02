import { pgTable, text, timestamp, varchar, real } from 'drizzle-orm/pg-core';
import { visits } from './patient';

export const emrSoap = pgTable('emr_soap', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    dokterId: text('dokter_id').notNull(),
    subjektif: text('subjektif'),
    objektif: text('objektif'),
    asesmen: text('asesmen'),
    planning: text('planning'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const igdTriase = pgTable('igd_triase', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    triase: varchar('triase', { length: 20 }).notNull(), // merah, kuning, hijau, hitam
    keluhanUtama: text('keluhan_utama').notNull(),
    tensi: varchar('tensi', { length: 20 }),
    nadi: varchar('nadi', { length: 20 }),
    suhu: real('suhu'),
    pernapasan: varchar('pernapasan', { length: 20 }),
    kesadaran: varchar('kesadaran', { length: 50 }),
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
