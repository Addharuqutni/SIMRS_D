import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from '../../db/testing';
import type { Db } from '../../db/types';
import { patients, visits } from '../../db/schemas/patient';
import { billings, billingItems, transactions } from '../../db/schemas/billing';
import { charge, finalize, pay, voidCharge } from './ledger';
import { DomainError } from '../../utils/domain-error';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(async () => {
    await db.execute(sql`truncate transactions, billing_items, billings, visits, patients cascade`);
    await db.insert(patients).values({ id: 'P1', rm: 'RM000001', nama: 'Budi' });
    await db.insert(visits).values({ id: 'V1', patientId: 'P1', poliId: 'Umum', dokterId: 'D1', jaminan: 'Umum', tipeKunjungan: 'rawat_jalan' });
});

const obat = (sourceRef: string, harga = 1000, jumlah = 2) =>
    ({ visitId: 'V1', kategori: 'Farmasi' as const, namaItem: 'Paracetamol', harga, jumlah, sourceRef });

const status = async (p: Promise<unknown>) => {
    try { await p; return 'ok'; } catch (e) { return e instanceof DomainError ? e.status : e; }
};

describe('Billing ledger', () => {
    it('records a charge once per sourceRef', async () => {
        expect(await charge(db, obat('RESEP:1:a'))).toBe(true);
        expect(await charge(db, obat('RESEP:1:a'))).toBe(false);
        const [bill] = await db.select().from(billings);
        expect(bill.total).toBe(2000);
        expect(await db.select().from(billingItems)).toHaveLength(1);
    });

    it('rejects charges for an unknown Kunjungan', async () => {
        expect(await status(charge(db, { ...obat('X'), visitId: 'nope' }))).toBe(404);
    });

    it('finalize totals exactly what was charged, then refuses new charges', async () => {
        await charge(db, obat('A', 1000, 2));
        await charge(db, { ...obat('B', 5000, 1), kategori: 'Laboratorium' });
        const bill = await finalize(db, 'V1');
        expect(bill.status).toBe('finalized');
        expect(bill.total).toBe(7000);
        expect(await status(charge(db, obat('C')))).toBe(409);
        expect(await status(finalize(db, 'V1'))).toBe(409);
    });

    it('voidCharge removes an open charge but not a finalized one', async () => {
        await charge(db, obat('A'));
        await charge(db, obat('B'));
        await voidCharge(db, 'A');
        expect((await db.select().from(billings))[0].total).toBe(2000);
        await finalize(db, 'V1');
        expect(await status(voidCharge(db, 'B'))).toBe(409);
    });

    it('pay settles once and writes exactly one ledger row', async () => {
        await charge(db, obat('A'));
        const bill = await finalize(db, 'V1');
        await pay(db, bill.id, 'tunai', 'U1');
        expect(await status(pay(db, bill.id, 'tunai', 'U1'))).toBe(409);
        const rows = await db.select().from(transactions);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ jenis: 'pendapatan', jumlah: 2000, dicatatOleh: 'U1' });
    });

    it('cannot pay an open bill', async () => {
        await charge(db, obat('A'));
        const [bill] = await db.select().from(billings);
        expect(await status(pay(db, bill.id, 'tunai', undefined))).toBe(409);
    });

    it('books BPJS payment as piutang', async () => {
        await charge(db, obat('A'));
        const bill = await finalize(db, 'V1');
        await pay(db, bill.id, 'bpjs', undefined);
        expect((await db.select().from(transactions))[0].jenis).toBe('piutang');
    });
});
