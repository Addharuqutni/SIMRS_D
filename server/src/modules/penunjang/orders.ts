/**
 * Penunjang orders — Lab (LIS) and Radiologi (RIS) share one domain module.
 *
 * Every function takes `(db, kind)` where kind is 'lab' | 'radiologi'; the only
 * per-kind differences are the table, the id prefix, the billing category /
 * tariff key and which column stores the result text. Routes, the EMR and the
 * UI never write `lab_orders` / `radiology_orders` directly.
 *
 * Invariants:
 *  - an order exists only for a Kunjungan that exists and is still open
 *    (menunggu | pemeriksaan); selesai/batal visits are rejected with 400;
 *  - `dokterId` must be an active user holding a DOCTOR_ROLES role (400 otherwise);
 *  - ids are `LAB-<nanoid>` / `RAD-<nanoid>`;
 *  - creating an order charges the visit's bill once (`ORDER:<id>`) at the
 *    tariff from settings, in the SAME transaction as the insert;
 *  - status follows the shared 'order' lifecycle: menunggu → diproses → selesai,
 *    with batal allowed from menunggu/diproses; cancelling voids the charge;
 *  - `waktuSelesai` is set by the server, never by the caller;
 *  - attaching a hasil PDF returns the replaced path so the route can unlink it.
 */
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db, DbOrTx } from '../../db/types';
import { labOrders, radiologyOrders } from '../../db/schemas/clinical';
import { patients, visits } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { DOCTOR_ROLES } from '../../../../shared/access';
import { DomainError, notFound } from '../../utils/domain-error';
import { assertTransition } from '../../utils/transition';
import { countsByStatus, toPage, type PageParams } from '../../utils/pagination';
import type { Page } from '../../../../shared/page';
import { getServiceTariffs } from '../settings';
import { charge, voidCharge } from '../billing/ledger';

export type OrderKind = 'lab' | 'radiologi';

/** Kunjungan states in which a new penunjang order may be placed. */
const OPEN_VISIT_STATUSES = ['menunggu', 'pemeriksaan', 'tindakan', 'observasi'];

const KIND_DEF = {
    lab: { prefix: 'LAB-', kategori: 'Laboratorium' as const, tarif: 'laboratorium' as const, label: 'Laboratorium' },
    radiologi: { prefix: 'RAD-', kategori: 'Radiologi' as const, tarif: 'radiologi' as const, label: 'Radiologi' },
};

type OrderTable = typeof labOrders | typeof radiologyOrders;
const TABLES: Record<OrderKind, OrderTable> = { lab: labOrders, radiologi: radiologyOrders };

export interface CreateOrderInput {
    visitId: string;
    dokterId: string;
    jenisPemeriksaan: string;
    catatan?: string | null;
}

export interface CompleteOrderInput {
    /** Lab result text; ignored for radiologi. */
    hasilTeks?: string | null;
    /** Radiologist's reading; ignored for lab. */
    expertise?: string | null;
    catatan?: string | null;
}

export interface OrderRow {
    id: string;
    visitId: string;
    patientName: string | null;
    rm: string | null;
    dokterId: string;
    dokterName: string | null;
    jenisPemeriksaan: string;
    catatan: string | null;
    status: string;
    /** Uploaded PDF path (`/uploads/...`), from either kind's result column. */
    hasilUrl: string | null;
    hasilTeks: string | null;
    expertise: string | null;
    waktuOrder: Date;
    waktuSelesai: Date | null;
}

/** Keeps the unified projection's absent columns typed `string | null`. */
const NULL_TEXT = sql<string | null>`null`;

/** Columns both order tables share; the union table resolves these. */
const commonColumns = (table: OrderTable) => ({
    id: table.id,
    visitId: table.visitId,
    dokterId: table.dokterId,
    jenisPemeriksaan: table.jenisPemeriksaan,
    catatan: table.catatan,
    status: table.status,
    waktuOrder: table.waktuOrder,
    waktuSelesai: table.waktuSelesai,
    patientName: patients.nama,
    rm: patients.rm,
    dokterName: users.name,
});

/** One projection for both kinds: the result columns are unified to a single shape. */
const orderColumns = (kind: OrderKind) => {
    const table = TABLES[kind];
    return kind === 'lab'
        ? { ...commonColumns(table), hasilUrl: labOrders.hasilUrl, hasilTeks: labOrders.hasilTeks, expertise: NULL_TEXT }
        : { ...commonColumns(table), hasilUrl: radiologyOrders.hasilDicomUrl, hasilTeks: NULL_TEXT, expertise: radiologyOrders.expertise };
};

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Order list for one unit: search pasien / RM / jenis, per-status counts. */
export async function listOrders(db: Db, kind: OrderKind, params: PageParams): Promise<Page<OrderRow>> {
    const table = TABLES[kind];
    const search: SQL | undefined = params.q
        ? or(ilike(patients.nama, `%${params.q}%`), ilike(patients.rm, `%${params.q}%`), ilike(table.jenisPemeriksaan, `%${params.q}%`))
        : undefined;

    const [rows, statusRows] = await Promise.all([
        db.select(orderColumns(kind)).from(table)
            .leftJoin(users, eq(table.dokterId, users.id))
            .leftJoin(visits, eq(table.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(and(search, params.status ? eq(table.status, params.status) : undefined))
            .orderBy(desc(table.waktuOrder))
            .limit(params.limit).offset(params.offset),
        db.select({ status: table.status, n: count() }).from(table)
            .leftJoin(visits, eq(table.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(search).groupBy(table.status),
    ]);

    const counts = countsByStatus(statusRows);
    const total = params.status ? (counts[params.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    return toPage(rows as OrderRow[], total, params, counts);
}

/** Single order with its patient and sender, or 404. */
export async function getOrder(db: DbOrTx, kind: OrderKind, id: string): Promise<OrderRow> {
    const table = TABLES[kind];
    const [row] = await db.select(orderColumns(kind)).from(table)
        .leftJoin(users, eq(table.dokterId, users.id))
        .leftJoin(visits, eq(table.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(table.id, id)).limit(1);
    if (!row) throw notFound('Order');
    return row as OrderRow;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** Insert with the shared column set; branches only to keep the table type exact. */
const insertOrder = async (tx: DbOrTx, kind: OrderKind, row: {
    id: string; visitId: string; dokterId: string; jenisPemeriksaan: string; catatan: string | null; status: string;
}) => {
    const [created] = kind === 'lab'
        ? await tx.insert(labOrders).values(row).returning()
        : await tx.insert(radiologyOrders).values(row).returning();
    return created;
};

const assertDoctor = async (db: DbOrTx, dokterId: string) => {
    const [doctor] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.id, dokterId), inArray(users.role, [...DOCTOR_ROLES]))).limit(1);
    if (!doctor) throw new DomainError('Dokter pengirim tidak valid', 400);
    return doctor;
};

/**
 * Places one penunjang order and charges it to the Kunjungan's bill
 * (`ORDER:<id>`, at the tariff configured in settings) in one transaction.
 */
export async function createOrder(db: Db, kind: OrderKind, input: CreateOrderInput) {
    const jenisPemeriksaan = input.jenisPemeriksaan.trim();
    if (!jenisPemeriksaan) throw new DomainError('Jenis pemeriksaan wajib diisi', 400);

    const [visit] = await db.select({ id: visits.id, status: visits.status }).from(visits)
        .where(eq(visits.id, input.visitId)).limit(1);
    if (!visit) throw new DomainError('Kunjungan tidak ditemukan', 400);
    if (!OPEN_VISIT_STATUSES.includes(visit.status)) {
        throw new DomainError(`Kunjungan sudah ${visit.status}, order baru tidak dapat dibuat`, 400);
    }
    await assertDoctor(db, input.dokterId);

    const def = KIND_DEF[kind];
    const id = `${def.prefix}${nanoid(8)}`;

    return db.transaction(async (tx) => {
        const order = await insertOrder(tx, kind, {
            id,
            visitId: visit.id,
            dokterId: input.dokterId,
            jenisPemeriksaan,
            catatan: input.catatan?.trim() || null,
            status: 'menunggu',
        });

        const tarif = (await getServiceTariffs(tx))[def.tarif];
        await charge(tx, {
            visitId: visit.id,
            kategori: def.kategori,
            namaItem: `${def.kategori}: ${jenisPemeriksaan}`,
            harga: tarif,
            sourceRef: `ORDER:${id}`,
        });

        return order;
    });
}

/** menunggu → diproses (sample accepted / examination started). */
export async function startOrder(db: Db, kind: OrderKind, id: string) {
    const order = await getOrder(db, kind, id);
    assertTransition('order', order.status, 'diproses');

    const table = TABLES[kind];
    const [updated] = await db.update(table).set({ status: 'diproses' })
        .where(and(eq(table.id, id), eq(table.status, 'menunggu')))
        .returning({ id: table.id, status: table.status });
    if (!updated) throw new DomainError('Order berubah oleh proses lain, muat ulang', 409);
    return updated;
}

/** diproses → selesai, stamping the result text and the server-set waktuSelesai. */
export async function completeOrder(db: Db, kind: OrderKind, id: string, input: CompleteOrderInput) {
    const order = await getOrder(db, kind, id);
    assertTransition('order', order.status, 'selesai');

    const catatan = input.catatan === undefined ? undefined : input.catatan?.trim() || null;
    const waktuSelesai = new Date();

    if (kind === 'lab') {
        const [updated] = await db.update(labOrders).set({
            status: 'selesai',
            waktuSelesai,
            ...(input.hasilTeks === undefined ? {} : { hasilTeks: input.hasilTeks?.trim() || null }),
            ...(catatan === undefined ? {} : { catatan }),
        }).where(and(eq(labOrders.id, id), eq(labOrders.status, 'diproses')))
            .returning({ id: labOrders.id, status: labOrders.status, waktuSelesai: labOrders.waktuSelesai });
        if (!updated) throw new DomainError('Order berubah oleh proses lain, muat ulang', 409);
        return updated;
    }

    const [updated] = await db.update(radiologyOrders).set({
        status: 'selesai',
        waktuSelesai,
        ...(input.expertise === undefined ? {} : { expertise: input.expertise?.trim() || null }),
        ...(catatan === undefined ? {} : { catatan }),
    }).where(and(eq(radiologyOrders.id, id), eq(radiologyOrders.status, 'diproses')))
        .returning({ id: radiologyOrders.id, status: radiologyOrders.status, waktuSelesai: radiologyOrders.waktuSelesai });
    if (!updated) throw new DomainError('Order berubah oleh proses lain, muat ulang', 409);
    return updated;
}

/**
 * Stores `/uploads/<filename>` on the order and returns the path it replaced
 * (`null` when there was none) so the route can delete the stale file.
 * Allowed while the order is still being worked on.
 */
export async function attachResult(db: Db, kind: OrderKind, id: string, filename: string) {
    const order = await getOrder(db, kind, id);
    if (order.status === 'batal') throw new DomainError('Order sudah dibatalkan', 409);
    if (order.status === 'selesai') throw new DomainError('Order sudah selesai; hasil tidak dapat diganti', 409);

    const path = `/uploads/${filename}`;
    if (kind === 'lab') {
        const [updated] = await db.update(labOrders).set({ hasilUrl: path })
            .where(and(eq(labOrders.id, id), inArray(labOrders.status, ['menunggu', 'diproses'])))
            .returning({ id: labOrders.id, status: labOrders.status });
        if (!updated) throw new DomainError('Order berubah oleh proses lain, muat ulang', 409);
        return { order: updated, replaced: order.hasilUrl };
    }

    const [updated] = await db.update(radiologyOrders).set({ hasilDicomUrl: path })
        .where(and(eq(radiologyOrders.id, id), inArray(radiologyOrders.status, ['menunggu', 'diproses'])))
        .returning({ id: radiologyOrders.id, status: radiologyOrders.status });
    if (!updated) throw new DomainError('Order berubah oleh proses lain, muat ulang', 409);
    return { order: updated, replaced: order.hasilUrl };
}

/** menunggu|diproses → batal and releases the charge; refused once the bill is finalized. */
export async function cancelOrder(db: Db, kind: OrderKind, id: string) {
    const order = await getOrder(db, kind, id);
    assertTransition('order', order.status, 'batal');

    const table = TABLES[kind];
    return db.transaction(async (tx) => {
        const [updated] = await tx.update(table).set({ status: 'batal' })
            .where(and(eq(table.id, id), inArray(table.status, ['menunggu', 'diproses'])))
            .returning({ id: table.id, status: table.status });
        if (!updated) throw new DomainError('Order berubah oleh proses lain, muat ulang', 409);
        await voidCharge(tx, `ORDER:${id}`);
        return updated;
    });
}
