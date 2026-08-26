import { pgTable, serial, varchar, integer, timestamp, date, text, boolean } from 'drizzle-orm/pg-core';

/**
 * Inventory locations (multi-warehouse). Each represents a physical storage
 * point: Farmasi Pusat, Depot IGD, Depot OK, Apotek Rawat Inap, etc.
 * Enables per-location stock tracking and inter-location transfers.
 */
export const inventoryLocations = pgTable('inventory_locations', {
    id: serial('id').primaryKey(),
    kode: varchar('kode', { length: 20 }).notNull().unique(), // FARMASI_PUSAT, DEPOT_IGD, DEPOT_OK
    nama: varchar('nama', { length: 100 }).notNull(),
    tipe: varchar('tipe', { length: 30 }).notNull().default('farmasi'), // farmasi, depot, ok, igd
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const medicines = pgTable('medicines', {
    id: serial('id').primaryKey(),
    kodeObat: varchar('kode_obat', { length: 50 }).notNull().unique(),
    nama: varchar('nama', { length: 200 }).notNull(),
    kategori: varchar('kategori', { length: 100 }), // Cair, Tablet, Kapsul, dll
    satuan: varchar('satuan', { length: 50 }),
    hargaBeli: integer('harga_beli').notNull().default(0),
    hargaJual: integer('harga_jual').notNull().default(0),
    stok: integer('stok').notNull().default(0), // Total aggregate stock (all locations)
    minStok: integer('min_stok').notNull().default(10),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Per-location stock quantities. The sum across locations for a medicine
 * equals `medicines.stok` (aggregate). Mutations update both tables.
 */
export const stockByLocation = pgTable('stock_by_location', {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id).notNull(),
    locationId: integer('location_id').references(() => inventoryLocations.id).notNull(),
    stok: integer('stok').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stockBatches = pgTable('stock_batches', {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id).notNull(),
    noBatch: varchar('no_batch', { length: 100 }).notNull(),
    expiredDate: date('expired_date').notNull(),
    qtyMasuk: integer('qty_masuk').notNull(),
    qtySisa: integer('qty_sisa').notNull(),
    supplier: varchar('supplier', { length: 200 }),
    // Optional location scoping — a batch may live in a specific depot
    locationId: integer('location_id').references(() => inventoryLocations.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Inter-location stock transfer records. Supports audit trail for
 * movements between Farmasi Pusat → Depot IGD, etc.
 */
export const stockTransfers = pgTable('stock_transfers', {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id).notNull(),
    fromLocationId: integer('from_location_id').references(() => inventoryLocations.id).notNull(),
    toLocationId: integer('to_location_id').references(() => inventoryLocations.id).notNull(),
    qty: integer('qty').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('selesai'), // pending, selesai, batal
    requestedBy: text('requested_by'),
    catatan: text('catatan'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockMutations = pgTable('stock_mutations', {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id).notNull(),
    batchId: integer('batch_id').references(() => stockBatches.id),
    jenis: varchar('jenis', { length: 20 }).notNull(), // MASUK, KELUAR, RETUR, PENYESUAIAN, TRANSFER
    qty: integer('qty').notNull(),
    keterangan: text('keterangan'),
    referensi: varchar('referensi', { length: 100 }), // No Resep, No Faktur
    locationId: integer('location_id').references(() => inventoryLocations.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
