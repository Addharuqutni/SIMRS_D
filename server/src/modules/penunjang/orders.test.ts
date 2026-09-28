import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb } from '../../db/testing';
import type { Db } from '../../db/types';
import { users } from '../../db/schemas/auth';
import { patients, visits } from '../../db/schemas/patient';
import { labOrders, radiologyOrders } from '../../db/schemas/clinical';
import { billings, billingItems } from '../../db/schemas/billing';
import { DomainError } from '../../utils/domain-error';
import { attachResult, cancelOrder, completeOrder, createOrder, getOrder, listOrders, startOrder } from './orders';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

beforeEach(async () => {
    await db.execute(sql`truncate billing_items, billings, lab_orders, radiology_orders, visits, patients, users cascade`);
    const now = new Date();
    await db.insert(users).values([
        { id: 'DOK', name: 'dr. Sari', email: 'd@x', role: 'Dokter Spesialis', createdAt: now, updatedAt: now },
        { id: 'NRS', name: 'Ners Ani', email: 'n@x', role: 'Perawat', createdAt: now, updatedAt: now },
    ]);
    await db.insert(patients).values({ id: 'P1', rm: 'RM000001', nama: 'Budi Santoso' });
    await db.insert(visits).values([
        { id: 'V1', patientId: 'P1', poliId: 'Poli Umum', dokterId: 'DOK', jaminan: 'Umum / Mandiri', tipeKunjungan: 'rawat_jalan', status: 'pemeriksaan' },
        { id: 'V-DONE', patientId: 'P1', poliId: 'Poli Umum', dokterId: 'DOK', jaminan: 'Umum / Mandiri', tipeKunjungan: 'rawat_jalan', status: 'selesai' },
    ]);
});

const order = (overrides: Partial<Parameters<typeof createOrder>[2]> = {}) =>
    createOrder(db, 'lab', { visitId: 'V1', dokterId: 'DOK', jenisPemeriksaan: 'Darah Lengkap', ...overrides });

const status = async (p: Promise<unknown>) => {
    try { await p; return 'ok'; } catch (e) { return e instanceof DomainError ? e.status : e; }
};

describe('Penunjang orders', () => {
    it('creates an order and charges it to the visit bill exactly once', async () => {
        const created = await order();
        expect(created.id).toMatch(/^LAB-[A-Za-z0-9_-]{8}$/);
        expect(created.status).toBe('menunggu');

        const items = await db.select().from(billingItems);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            kategori: 'Laboratorium',
            namaItem: 'Laboratorium: Darah Lengkap',
            harga: 100000,
            jumlah: 1,
            subtotal: 100000,
            sourceRef: `ORDER:${created.id}`,
        });
        expect((await db.select().from(billings))[0].total).toBe(100000);

        // A second order for the same visit is a separate charge, not a duplicate.
        await order({ jenisPemeriksaan: 'Gula Darah' });
        expect(await db.select().from(billingItems)).toHaveLength(2);
        expect((await db.select().from(billings))[0].total).toBe(200000);
    });

    it('prices the order from the settings tariff', async () => {
        const created = await createOrder(db, 'radiologi', { visitId: 'V1', dokterId: 'DOK', jenisPemeriksaan: 'Rontgen Thorax' });
        expect((await db.select().from(billingItems))[0]).toMatchObject({ kategori: 'Radiologi', harga: 250000 });
        expect(created.id).toMatch(/^RAD-/);
    });

    it('rejects an unknown visit, a finished visit and a non-doctor sender', async () => {
        expect(await status(order({ visitId: 'nope' }))).toBe(400);
        expect(await status(order({ visitId: 'V-DONE' }))).toBe(400);
        expect(await status(order({ dokterId: 'NRS' }))).toBe(400);
        expect(await status(order({ dokterId: 'nobody' }))).toBe(400);
        expect(await db.select().from(labOrders)).toHaveLength(0);
        expect(await db.select().from(billingItems)).toHaveLength(0);
    });

    it('cannot complete an order that was never started', async () => {
        const created = await order();
        expect(await status(completeOrder(db, 'lab', created.id, { hasilTeks: 'WBC 7.2' }))).toBe(409);
        expect((await db.select().from(labOrders))[0].status).toBe('menunggu');
    });

    it('start then complete stamps the result and the server-set waktuSelesai', async () => {
        const created = await order();
        expect((await startOrder(db, 'lab', created.id)).status).toBe('diproses');
        expect(await status(startOrder(db, 'lab', created.id))).toBe(409);

        const done = await completeOrder(db, 'lab', created.id, { hasilTeks: 'WBC 7.2 | HGB 14.2' });
        expect(done.status).toBe('selesai');
        expect(done.waktuSelesai).toBeInstanceOf(Date);

        const [row] = await db.select().from(labOrders).where(eq(labOrders.id, created.id));
        expect(row).toMatchObject({ status: 'selesai', hasilTeks: 'WBC 7.2 | HGB 14.2' });
        expect(row.waktuSelesai).toBeInstanceOf(Date);
        expect(await status(completeOrder(db, 'lab', created.id, {}))).toBe(409);
    });

    it('cancels a pending order and voids its charge', async () => {
        const created = await order();
        const cancelled = await cancelOrder(db, 'lab', created.id);
        expect(cancelled.status).toBe('batal');
        expect(await db.select().from(billingItems)).toHaveLength(0);
        expect((await db.select().from(billings))[0].total).toBe(0);
        expect(await status(cancelOrder(db, 'lab', created.id))).toBe(409);
    });

    it('refuses to cancel once the bill is finalized, leaving the charge alone', async () => {
        const created = await order();
        await db.update(billings).set({ status: 'finalized' }).where(eq(billings.visitId, 'V1'));
        expect(await status(cancelOrder(db, 'lab', created.id))).toBe(409);
        expect(await db.select().from(billingItems)).toHaveLength(1);
    });

    it('attaches a hasil PDF and reports the file it replaced', async () => {
        const created = await order();
        const first = await attachResult(db, 'lab', created.id, 'LAB-1-a.pdf');
        expect(first).toMatchObject({ replaced: null });
        expect((await getOrder(db, 'lab', created.id)).hasilUrl).toBe('/uploads/LAB-1-a.pdf');

        const second = await attachResult(db, 'lab', created.id, 'LAB-1-b.pdf');
        expect(second.replaced).toBe('/uploads/LAB-1-a.pdf');
        expect((await getOrder(db, 'lab', created.id)).hasilUrl).toBe('/uploads/LAB-1-b.pdf');

        await startOrder(db, 'lab', created.id);
        await completeOrder(db, 'lab', created.id, { hasilTeks: 'ok' });
        expect(await status(attachResult(db, 'lab', created.id, 'LAB-1-c.pdf'))).toBe(409);
    });

    it('keeps radiology expertise on the radiology table', async () => {
        const created = await createOrder(db, 'radiologi', { visitId: 'V1', dokterId: 'DOK', jenisPemeriksaan: 'USG Abdomen' });
        await startOrder(db, 'radiologi', created.id);

        const attached = await attachResult(db, 'radiologi', created.id, 'RAD-1-a.pdf');
        expect(attached.replaced).toBeNull();

        await completeOrder(db, 'radiologi', created.id, { expertise: 'Tidak ada kelainan' });

        const [row] = await db.select().from(radiologyOrders).where(eq(radiologyOrders.id, created.id));
        expect(row).toMatchObject({ status: 'selesai', expertise: 'Tidak ada kelainan', hasilDicomUrl: '/uploads/RAD-1-a.pdf' });
        expect(await db.select().from(labOrders)).toHaveLength(0);
        expect((await getOrder(db, 'radiologi', created.id)).hasilUrl).toBe('/uploads/RAD-1-a.pdf');
    });

    it('lists per kind as a page with search and status counts', async () => {
        const a = await order({ jenisPemeriksaan: 'Darah Lengkap' });
        await order({ jenisPemeriksaan: 'Gula Darah' });
        await startOrder(db, 'lab', a.id);
        await createOrder(db, 'radiologi', { visitId: 'V1', dokterId: 'DOK', jenisPemeriksaan: 'Rontgen Thorax' });

        const page = await listOrders(db, 'lab', { page: 1, limit: 10, offset: 0 });
        expect(page.data).toHaveLength(2);
        expect(page.pagination.total).toBe(2);
        expect(page.counts).toEqual({ menunggu: 1, diproses: 1 });
        expect(page.data[0]).toMatchObject({ patientName: 'Budi Santoso', rm: 'RM000001', dokterName: 'dr. Sari' });

        const searched = await listOrders(db, 'lab', { page: 1, limit: 10, offset: 0, q: 'Gula' });
        expect(searched.data).toHaveLength(1);
        expect(searched.data[0].jenisPemeriksaan).toBe('Gula Darah');

        const byPatient = await listOrders(db, 'lab', { page: 1, limit: 10, offset: 0, q: 'RM000001' });
        expect(byPatient.data).toHaveLength(2);

        const filtered = await listOrders(db, 'lab', { page: 1, limit: 10, offset: 0, status: 'diproses' });
        expect(filtered.data).toHaveLength(1);
        expect(filtered.pagination.total).toBe(1);

        const radiologi = await listOrders(db, 'radiologi', { page: 1, limit: 10, offset: 0 });
        expect(radiologi.data).toHaveLength(1);
        expect(radiologi.counts).toEqual({ menunggu: 1 });
    });
});
