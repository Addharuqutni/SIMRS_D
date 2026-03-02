import { pgTable, serial, varchar, integer, timestamp, date, text } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const doctorSchedules = pgTable('doctor_schedules', {
    id: serial('id').primaryKey(),
    doctorId: text('doctor_id').references(() => users.id).notNull(),
    poliId: varchar('poli_id', { length: 50 }).notNull(),
    dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 1 = Monday, etc.
    startTime: varchar('start_time', { length: 5 }).notNull(), // HH:mm
    endTime: varchar('end_time', { length: 5 }).notNull(), // HH:mm
    quota: integer('quota').notNull().default(0),
    isActive: integer('is_active').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const queues = pgTable('queues', {
    id: serial('id').primaryKey(),
    visitId: text('visit_id').notNull(), // Reference to visits.id
    poliId: varchar('poli_id', { length: 50 }).notNull(),
    queueNumber: integer('queue_number').notNull(),
    queueCode: varchar('queue_code', { length: 10 }), // A-01, B-12
    status: varchar('status', { length: 20 }).notNull().default('menunggu'), // menunggu, dipanggil, diperiksa, selesai, batal
    loket: varchar('loket', { length: 20 }), // Loket 1, Poli Umum, dll
    calledAt: timestamp('called_at'),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
