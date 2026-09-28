import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb } from '../../db/testing';
import type { Db } from '../../db/types';
import { patients, visits } from '../../db/schemas/patient';
import { medicines, stockBatches, stockMutations } from '../../db/schemas/inventory';
import { billingItems } from '../../db/schemas/billing';
import { DomainError } from '../../utils/domain-error';
import { createResep, dispense, startProses } from './dispensing';

let db: Db;
let close: () => Promise<void>;
let obatId: number;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(async () => {
    await db.execute(sql`truncate billing_items, billings, stock_mutations, stock_batches, prescription_items, prescriptions, medicines, visits, patients restart identity cascade`);
    await db.insert(patients).values({ id: 'P1', rm: 'RM000001', nama: 'Budi' });
    await db.insert(visits).values({ id: 'V1', patientId: 'P1', poliId: 'Umum', dokterId: 'D1', jaminan: 'Umum', tipeKunjungan: 'rawat_jalan' });
    [{ id: obatId }] = await db.insert(medicines).values({ kodeObat: 'PCT', nama: 'Paracetamol', hargaJual: 500, stok: 10, minStok: 1 }).returning();
    await db.insert(stockBatches).values([
        { medicineId: obatId, noBatch: 'LATE', expiredDate: '2099-12-31', qtyMasuk: 6, qtySisa: 6 },
        { medicineId: obatId, noBatch: 'EARLY', expiredDate: '2098-01-01', qtyMasuk: 4, qtySisa: 4 },
    ]);
});

const status = async (p: Promise<unknown>) => {
    try { await p; return 'ok'; } catch (e) { return e instanceof DomainError ? e.status : e; }
};

async function resepReadyToDispense(jumlah: number) {
    const resep = await createResep(db, { visitId: 'V1', dokterId: 'D1', items: [{ obatId, dosis: '3x1', jumlah }] });
    await startProses(db, resep.id);
    return resep;
}

const stokOf = async () => (await db.select().from(medicines).where(eq(medicines.id, obatId)))[0].stok;
const batchSisa = async (noBatch: string) => (await db.select().from(stockBatches).where(eq(stockBatches.noBatch, noBatch)))[0].qtySisa;

describe('Resep dispensing', () => {
    it('dispenses once: a second dispense is 409 and stock is deducted once', async () => {
        const resep = await resepReadyToDispense(3);
        await dispense(db, resep.id, 'apoteker');
        expect(await status(dispense(db, resep.id, 'apoteker'))).toBe(409);
        expect(await stokOf()).toBe(7);
        expect(await db.select().from(billingItems)).toHaveLength(1);
    });

    it('rejects insufficient stock and writes nothing', async () => {
        const resep = await resepReadyToDispense(11);
        expect(await status(dispense(db, resep.id, 'apoteker'))).toBe(409);
        expect(await stokOf()).toBe(10);
        expect(await db.select().from(stockMutations)).toHaveLength(0);
        expect(await db.select().from(billingItems)).toHaveLength(0);
    });

    it('consumes the earliest-expiring batch first (FEFO), spilling into the next', async () => {
        const resep = await resepReadyToDispense(5);
        await dispense(db, resep.id, 'apoteker');
        expect(await batchSisa('EARLY')).toBe(0);
        expect(await batchSisa('LATE')).toBe(5);
    });

    it('never dispenses from expired batches', async () => {
        await db.update(stockBatches).set({ expiredDate: '2000-01-01' }).where(eq(stockBatches.noBatch, 'EARLY'));
        const resep = await resepReadyToDispense(7);
        expect(await status(dispense(db, resep.id, 'apoteker'))).toBe(409);
    });

    it('bills at the price at dispense time; later price changes do not alter the bill', async () => {
        const resep = await resepReadyToDispense(2);
        await dispense(db, resep.id, 'apoteker');
        await db.update(medicines).set({ hargaJual: 9999 }).where(eq(medicines.id, obatId));
        const [item] = await db.select().from(billingItems);
        expect(item).toMatchObject({ harga: 500, jumlah: 2, subtotal: 1000 });
    });

    it('requires proses before selesai', async () => {
        const resep = await createResep(db, { visitId: 'V1', dokterId: 'D1', items: [{ obatId, dosis: '1x1', jumlah: 1 }] });
        expect(await status(dispense(db, resep.id, 'apoteker'))).toBe(409);
    });

    it('rejects an unknown obatId when the Resep is written', async () => {
        expect(await status(createResep(db, { visitId: 'V1', dokterId: 'D1', items: [{ obatId: 424242, dosis: '1x1', jumlah: 1 }] }))).toBe(400);
    });
});
