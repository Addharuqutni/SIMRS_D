import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb } from '../../db/testing';
import type { Db } from '../../db/types';
import { patients, sepRecords, visits } from '../../db/schemas/patient';
import { billings, bpjsClaims } from '../../db/schemas/billing';
import { DomainError } from '../../utils/domain-error';
import { FakeVClaimAdapter } from './fake-adapter';
import { applyHasilVerifikasi, batalSep, cekPeserta, issueSep, transitionKlaim } from './sep-klaim';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

beforeEach(async () => {
    await db.execute(sql`truncate bpjs_claims, sep_records, billings, billing_items, visits, patients cascade`);
    await db.insert(patients).values({ id: 'P1', rm: 'RM000001', nama: 'Budi Santoso', tanggalLahir: '1980-01-01' });
    await db.insert(visits).values([
        { id: 'V-BPJS', patientId: 'P1', poliId: 'Poli Umum', dokterId: 'D1', jaminan: 'BPJS Kesehatan', tipeKunjungan: 'rawat_jalan' },
        { id: 'V-UMUM', patientId: 'P1', poliId: 'Poli Umum', dokterId: 'D1', jaminan: 'Umum / Mandiri', tipeKunjungan: 'rawat_jalan' },
    ]);
});

const port = () => new FakeVClaimAdapter();
const issue = (sepPort = port(), visitId = 'V-BPJS') =>
    issueSep(db, sepPort, { visitId, noKartu: '0001234567890', diagnosa: 'J06.9 - ISPA', ppkRujukan: 'Puskesmas Melati' });

const status = async (p: Promise<unknown>) => {
    try { await p; return 'ok'; } catch (e) { return e instanceof DomainError ? e.status : e; }
};

describe('SEP & Klaim BPJS', () => {
    it('rejects a non-aktif peserta and stores nothing', async () => {
        const p = new FakeVClaimAdapter({ pesertaAktif: false });
        expect(await status(issue(p))).toBe(422);
        expect(await db.select().from(sepRecords)).toHaveLength(0);
        expect(await db.select().from(bpjsClaims)).toHaveLength(0);
    });

    it('reports peserta status through cekPeserta', async () => {
        expect(await cekPeserta(port(), '0001234567890')).toMatchObject({ status: 'AKTIF', aktif: true });
        expect(await cekPeserta(new FakeVClaimAdapter({ pesertaAktif: false }), '0001234567890'))
            .toMatchObject({ status: 'NONAKTIF', aktif: false });
    });

    it('rejects a non-BPJS Kunjungan with 400', async () => {
        expect(await status(issue(port(), 'V-UMUM'))).toBe(400);
        expect(await status(issue(port(), 'V-UNKNOWN'))).toBe(404);
        expect(await db.select().from(sepRecords)).toHaveLength(0);
    });

    it('creates SEP + Klaim with tarifRs from the billing total and inaCbg null', async () => {
        await db.insert(billings).values({ id: 'B1', visitId: 'V-BPJS', noBilling: 'INV-1', total: 275000, status: 'open' });

        const { sep, klaim } = await issue();

        expect(sep).toMatchObject({ visitId: 'V-BPJS', status: 'aktif', sumber: 'simulasi', ppkRujukan: 'Puskesmas Melati' });
        expect(sep.noSep).toMatch(/^SIM-/);
        expect(klaim).toMatchObject({ sepId: sep.id, tarifRs: 275000, inaCbg: null, tarifInaCbg: null, status: 'dibentuk' });
        expect(await db.select().from(bpjsClaims)).toHaveLength(1);
    });

    it('issues tarifRs 0 when the Kunjungan has no billing yet', async () => {
        const { klaim } = await issue();
        expect(klaim.tarifRs).toBe(0);
        expect(klaim.inaCbg).toBeNull();
    });

    it('refuses a second aktif SEP for the same Kunjungan', async () => {
        await issue();
        expect(await status(issue())).toBe(409);
        expect(await db.select().from(sepRecords)).toHaveLength(1);
    });

    it('allows a new SEP once the previous one is cancelled', async () => {
        const p = port();
        const { sep } = await issue(p);
        await batalSep(db, p, sep.id);
        expect((await db.select().from(sepRecords))[0].status).toBe('batal');
        const again = await issue(p);
        expect(again.sep.id).not.toBe(sep.id);
        expect(again.sep.noSep).not.toBe(sep.noSep);
        expect(await db.select().from(sepRecords)).toHaveLength(2);
    });

    it('cancels only an aktif SEP', async () => {
        const { sep } = await issue();
        await batalSep(db, port(), sep.id);
        expect(await status(batalSep(db, port(), sep.id))).toBe(409);
        expect(await status(batalSep(db, port(), 'nope'))).toBe(404);
        expect(port().sumber).toBe('simulasi');
    });

    it('moves a Klaim dibentuk → pending → layak and refuses layak → pending', async () => {
        const { klaim } = await issue();
        const pending = await transitionKlaim(db, klaim.id, 'pending');
        expect(pending.status).toBe('pending');
        expect(await status(transitionKlaim(db, klaim.id, 'bogus'))).toBe(400);
        expect(await status(transitionKlaim(db, klaim.id, 'dibentuk'))).toBe(409);

        const verified = await applyHasilVerifikasi(db, klaim.id, { inaCbg: 'Q-5-44-0', tarifInaCbg: 240000 });
        expect(verified).toMatchObject({ status: 'layak', inaCbg: 'Q-5-44-0', tarifInaCbg: 240000, tarifRs: 0 });

        expect(await status(transitionKlaim(db, klaim.id, 'pending'))).toBe(409);
        expect((await db.select().from(bpjsClaims).where(eq(bpjsClaims.id, klaim.id)))[0].status).toBe('layak');
    });

    it('routes a disputed Klaim back through pending', async () => {
        const { klaim } = await issue();
        await transitionKlaim(db, klaim.id, 'pending');
        expect((await transitionKlaim(db, klaim.id, 'dispute')).status).toBe('dispute');
        expect((await transitionKlaim(db, klaim.id, 'pending')).status).toBe('pending');
        expect((await transitionKlaim(db, klaim.id, 'layak')).status).toBe('layak');
        expect(await status(transitionKlaim(db, klaim.id, 'dispute'))).toBe(409);
    });

    it('surfaces adapter failures as 502 and stores nothing', async () => {
        const broken = new FakeVClaimAdapter({ failWith: 'layanan VClaim tidak tersedia' });
        expect(await status(issue(broken))).toBe(502);
        expect(await status(cekPeserta(broken, '0001234567890'))).toBe(502);
        expect(await db.select().from(sepRecords)).toHaveLength(0);
        expect(await db.select().from(bpjsClaims)).toHaveLength(0);
    });

    it('cancelling a SEP keeps the SEP active when the port fails', async () => {
        const { sep } = await issue();
        const broken = new FakeVClaimAdapter({ failWith: 'timeout' });
        expect(await status(batalSep(db, broken, sep.id))).toBe(502);
        expect((await db.select().from(sepRecords).where(eq(sepRecords.id, sep.id)))[0].status).toBe('aktif');
    });
});
