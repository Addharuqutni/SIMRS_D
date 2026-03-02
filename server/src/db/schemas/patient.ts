import { pgTable, text, timestamp, varchar, date, integer } from 'drizzle-orm/pg-core';

export const patients = pgTable('patients', {
    id: text('id').primaryKey(), // Using UUID or generated RM
    rm: varchar('rm', { length: 20 }).notNull().unique(),
    nik: varchar('nik', { length: 16 }).unique(),
    nama: text('nama').notNull(),
    tempatLahir: text('tempat_lahir'),
    tanggalLahir: date('tanggal_lahir'),
    gender: varchar('gender', { length: 20 }),
    goldar: varchar('goldar', { length: 5 }),
    agama: varchar('agama', { length: 50 }),
    alamat: text('alamat'),
    telepon: varchar('telepon', { length: 20 }),
    pekerjaan: varchar('pekerjaan', { length: 100 }),
    alergi: text('alergi'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const visits = pgTable('visits', {
    id: text('id').primaryKey(),
    patientId: text('patient_id').notNull().references(() => patients.id),
    poliId: text('poli_id').notNull(),
    dokterId: text('dokter_id').notNull(),
    jaminan: varchar('jaminan', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('menunggu'), // menunggu, pemeriksaan, selesai, batal
    tipeKunjungan: varchar('tipe_kunjungan', { length: 50 }).notNull(), // rawat_jalan, igd, rawat_inap
    waktuDaftar: timestamp('waktu_daftar').defaultNow().notNull(),
    waktuSelesai: timestamp('waktu_selesai'),
});

export const sepRecords = pgTable('sep_records', {
    id: text('id').primaryKey(),
    visitId: text('visit_id').notNull().references(() => visits.id),
    noSep: varchar('no_sep', { length: 50 }).notNull().unique(),
    noKartu: varchar('no_kartu', { length: 50 }).notNull(),
    diagnosa: text('diagnosa').notNull(),
    tglSep: date('tgl_sep').notNull(),
    ppkRujukan: text('ppk_rujukan'),
    status: varchar('status', { length: 50 }).notNull().default('aktif'), // aktif, terpakai, batal
});
