import { pgTable, serial, varchar, integer, timestamp, date, text } from 'drizzle-orm/pg-core';

export const medicines = pgTable('medicines', {
    id: serial('id').primaryKey(),
    kodeObat: varchar('kode_obat', { length: 50 }).notNull().unique(),
    nama: varchar('nama', { length: 200 }).notNull(),
    kategori: varchar('kategori', { length: 100 }), // Cair, Tablet, Kapsul, dll
    satuan: varchar('satuan', { length: 50 }),
    hargaBeli: integer('harga_beli').notNull().default(0),
    hargaJual: integer('harga_jual').notNull().default(0),
    stok: integer('stok').notNull().default(0),
    minStok: integer('min_stok').notNull().default(10),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockBatches = pgTable('stock_batches', {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id).notNull(),
    noBatch: varchar('no_batch', { length: 100 }).notNull(),
    expiredDate: date('expired_date').notNull(),
    qtyMasuk: integer('qty_masuk').notNull(),
    qtySisa: integer('qty_sisa').notNull(),
    supplier: varchar('supplier', { length: 200 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockMutations = pgTable('stock_mutations', {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id).notNull(),
    batchId: integer('batch_id').references(() => stockBatches.id),
    jenis: varchar('jenis', { length: 20 }).notNull(), // MASUK, KELUAR, RETUR, PENYESUAIAN
    qty: integer('qty').notNull(),
    keterangan: text('keterangan'),
    referensi: varchar('referensi', { length: 100 }), // No Resep, No Faktur
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
