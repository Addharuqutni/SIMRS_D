import { pgTable, text, timestamp, varchar, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { visits, sepRecords } from './patient';

export const billings = pgTable('billings', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().unique().references(() => visits.id),
    noBilling: varchar('no_billing', { length: 50 }).notNull().unique(),
    total: integer('total').notNull().default(0),
    status: varchar('status', { length: 50 }).notNull().default('open'), // open, finalized, paid
    waktuFinalisasi: timestamp('waktu_finalisasi'),
    waktuBayar: timestamp('waktu_bayar'),
    metodePembayaran: varchar('metode_pembayaran', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const billingItems = pgTable('billing_items', {
    id: text('id').primaryKey(),
    billingId: text('billing_id').notNull().references(() => billings.id),
    kategori: varchar('kategori', { length: 100 }).notNull(), // Poli, Farmasi, Laboratorium, Radiologi, Rawat Inap
    namaItem: text('nama_item').notNull(),
    harga: integer('harga').notNull(), // price snapshot at service time
    jumlah: integer('jumlah').notNull().default(1),
    subtotal: integer('subtotal').notNull(),
    // Identifies the service that produced this charge (e.g. RESEP:<id>:<itemId>); makes charge() idempotent.
    sourceRef: varchar('source_ref', { length: 120 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('billing_items_source_ref_uq').on(t.sourceRef)]);

export const bpjsClaims = pgTable('bpjs_claims', {
    id: text('id').primaryKey(),
    sepId: text('sep_id').notNull().references(() => sepRecords.id),
    inaCbg: varchar('ina_cbg', { length: 50 }),
    tarifRs: integer('tarif_rs').notNull(),
    tarifInaCbg: integer('tarif_inacbg'),
    status: varchar('status', { length: 50 }).notNull().default('dibentuk'), // dibentuk, pending, dispute, layak
    waktuKlaim: timestamp('waktu_klaim').defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
    id: text('id').primaryKey(),
    keterangan: text('keterangan').notNull(),
    kategori: varchar('kategori', { length: 100 }).notNull(),
    jenis: varchar('jenis', { length: 50 }).notNull(), // pendapatan, piutang, biaya
    jumlah: integer('jumlah').notNull(),
    tanggal: timestamp('tanggal', { mode: 'date' }).defaultNow().notNull(),
    referensi: varchar('referensi', { length: 100 }), // e.g. billing number
    dicatatOleh: text('dicatat_oleh'), // user id of the cashier / actor
});
