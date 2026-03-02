import { pgTable, text, timestamp, varchar, integer, real } from 'drizzle-orm/pg-core';
import { visits } from './patient';

export const prescriptions = pgTable('prescriptions', {
    id: text('id').primaryKey(),
    noResep: varchar('no_resep', { length: 50 }).notNull().unique(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    dokterId: text('dokter_id').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('baru'), // baru, proses, selesai
    waktuResep: timestamp('waktu_resep').defaultNow().notNull(),
    waktuSelesai: timestamp('waktu_selesai'),
});

export const prescriptionItems = pgTable('prescription_items', {
    id: text('id').primaryKey(),
    prescriptionId: text('prescription_id').notNull().references(() => prescriptions.id),
    obatId: text('obat_id').notNull(),
    dosis: varchar('dosis', { length: 100 }).notNull(),
    jumlah: integer('jumlah').notNull(),
    keterangan: text('keterangan'),
});
