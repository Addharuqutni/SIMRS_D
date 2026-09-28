import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb } from '../../db/testing';
import type { Db } from '../../db/types';
import { users } from '../../db/schemas/auth';
import { patients, visits } from '../../db/schemas/patient';
import { queues } from '../../db/schemas/schedule';
import { igdTriase, rawatInapAdmisi } from '../../db/schemas/clinical';
import { billingItems } from '../../db/schemas/billing';
import { DomainError } from '../../utils/domain-error';
import { admit, transitionAdmisi, transitionKunjungan, type AdmitInput } from './admission';

vi.mock('../../utils/websocket', () => ({ emitQueueUpdate: vi.fn() }));

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(async () => {
    await db.execute(sql`truncate billing_items, billings, queues, igd_triase, rawat_inap_admisi, notifications, visits, patients, users cascade`);
    const now = new Date();
    await db.insert(users).values([
        { id: 'DOK', name: 'dr. Sari', email: 'd@x', role: 'Dokter Umum', createdAt: now, updatedAt: now },
        { id: 'NRS', name: 'Ners Ani', email: 'n@x', role: 'Perawat', createdAt: now, updatedAt: now },
    ]);
});

const status = async (p: Promise<unknown>) => {
    try { await p; return 'ok'; } catch (e) { return e instanceof DomainError ? e.status : e; }
};

const baru = (nama: string) => ({ pasienBaru: { nama, gender: 'P' as const } });
const rajal = (extra: object = {}): AdmitInput => ({ jenis: 'rawat_jalan', poliId: 'Poli Umum', dokterId: 'DOK', jaminan: 'Umum / Mandiri', ...baru('Ani'), ...extra } as AdmitInput);
const igd = (): AdmitInput => ({ jenis: 'igd', triase: 'merah', keluhanUtama: 'Sesak', dokterId: 'DOK', jaminan: 'Umum / Mandiri', vitals: { nadi: 140, pernapasan: 30 }, ...baru('Budi') });

describe('Admission', () => {
    it('IGD admission creates patient, visit, queue, triase and the IGD charge together', async () => {
        const r = await admit(db, igd());
        expect(r.patient.gender).toBe('P');
        expect(await db.select().from(queues).where(eq(queues.visitId, r.visit.id))).toHaveLength(1);
        expect(await db.select().from(igdTriase).where(eq(igdTriase.visitId, r.visit.id))).toHaveLength(1);
        expect((await db.select().from(billingItems))[0]).toMatchObject({ kategori: 'Tindakan', sourceRef: `KUNJUNGAN:${r.visit.id}` });
    });

    it('leaves nothing behind when admission fails midway', async () => {
        expect(await status(admit(db, { ...igd(), dokterId: 'NRS' }))).toBe(400);
        expect(await db.select().from(patients)).toHaveLength(0);
        expect(await db.select().from(visits)).toHaveLength(0);
        expect(await db.select().from(queues)).toHaveLength(0);
    });

    it('rejects an unknown or non-doctor dokterId', async () => {
        expect(await status(admit(db, rajal({ dokterId: 'nobody' })))).toBe(400);
        expect(await status(admit(db, rajal({ dokterId: 'NRS' })))).toBe(400);
    });

    it('issues sequential, unique RM numbers', async () => {
        const rms = [];
        for (const n of ['A', 'B', 'C']) rms.push((await admit(db, rajal(baru(n)))).patient.rm);
        expect(rms).toEqual(['RM000001', 'RM000002', 'RM000003']);
    });

    it('numbers queues per poli per day', async () => {
        const a = await admit(db, rajal());
        const b = await admit(db, rajal({ patientId: a.patient.id, pasienBaru: undefined }));
        const c = await admit(db, rajal({ poliId: 'Poli Gigi' }));
        expect([a.queue.queueCode, b.queue.queueCode, c.queue.queueCode]).toEqual(['A-001', 'A-002', 'B-001']);
    });

    it('rejects a duplicate NIK', async () => {
        await admit(db, rajal({ pasienBaru: { nama: 'X', gender: 'L', nik: '1234567890123456' } }));
        expect(await status(admit(db, rajal({ pasienBaru: { nama: 'Y', gender: 'L', nik: '1234567890123456' } })))).toBe(409);
    });

    it('refuses to reopen a finished Kunjungan', async () => {
        const { visit } = await admit(db, rajal());
        await transitionKunjungan(db, visit.id, 'pemeriksaan');
        await transitionKunjungan(db, visit.id, 'selesai');
        expect(await status(transitionKunjungan(db, visit.id, 'menunggu'))).toBe(409);
        expect(await status(transitionKunjungan(db, visit.id, 'bogus'))).toBe(400);
    });

    it('cancelling a Kunjungan cancels its queue ticket', async () => {
        const { visit } = await admit(db, rajal());
        await transitionKunjungan(db, visit.id, 'batal');
        expect((await db.select().from(queues))[0].status).toBe('batal');
    });

    it('discharging a rawat inap patient charges room days × tariff once', async () => {
        const { visit } = await admit(db, { jenis: 'rawat_inap', ruanganId: 'Melati-1', kelas: 'Kelas 2', dokterId: 'DOK', jaminan: 'Umum / Mandiri', ...baru('C') });
        const [adm] = await db.select().from(rawatInapAdmisi).where(eq(rawatInapAdmisi.visitId, visit.id));
        await db.update(rawatInapAdmisi).set({ waktuMasuk: new Date(Date.now() - 2.5 * 86_400_000) }).where(eq(rawatInapAdmisi.id, adm.id));

        await transitionAdmisi(db, adm.id, 'pulang');
        expect(await status(transitionAdmisi(db, adm.id, 'pulang'))).toBe(409);

        const items = await db.select().from(billingItems);
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ harga: 350000, jumlah: 3, subtotal: 1050000 });
    });
});
