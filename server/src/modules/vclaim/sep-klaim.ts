/**
 * SEP & Klaim BPJS — the deep module owning every rule about SEP issuance and
 * INA-CBG claim status. Routes and UI never touch `sep_records`/`bpjs_claims`
 * directly; they call the functions below with a `Db` and a `VClaimPort`.
 *
 * Invariants:
 *  - a SEP exists only for a Kunjungan whose jaminan is 'BPJS Kesehatan';
 *  - the peserta must be AKTIF before anything is stored (checked first, and
 *    nothing is written when the check fails);
 *  - at most one aktif SEP per Kunjungan (others must be 'batal'/'terpakai');
 *  - SEP + Klaim are inserted in ONE transaction, so a claim never exists
 *    without its SEP;
 *  - `tarifRs` is the Kunjungan's own billing total (0 when unbilled) and
 *    `inaCbg` stays null until BPJS returns a grouping — nothing is invented;
 *  - `sumber` records which adapter produced the SEP (bpjs | simulasi);
 *  - provider failures surface as DomainError 502 (or 503 when unconfigured);
 *  - SEP status follows the shared 'sep' lifecycle, Klaim the 'klaim' one.
 */
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../../db/types';
import { patients, sepRecords, visits } from '../../db/schemas/patient';
import { billings, bpjsClaims } from '../../db/schemas/billing';
import { DomainError, notFound } from '../../utils/domain-error';
import { assertTransition } from '../../utils/transition';
import { countsByStatus, toPage, type PageParams } from '../../utils/pagination';
import type { Page } from '../../../../shared/page';
import type { PesertaKartu, SepSumber, VClaimPort } from './port';

export type { PesertaKartu, SepSumber };

/** jaminan value that entitles a Kunjungan to a SEP. */
const BPJS_JAMINAN = 'BPJS Kesehatan';

export interface IssueSepInput {
    visitId: string;
    noKartu: string;
    diagnosa: string;
    ppkRujukan?: string | null;
}

export interface SepRow {
    id: string;
    visitId: string;
    noSep: string;
    noKartu: string;
    diagnosa: string;
    tglSep: string;
    ppkRujukan: string | null;
    status: string;
    sumber: string;
    pasien: string | null;
    rm: string | null;
    jaminan: string | null;
}

export interface KlaimRow {
    id: string;
    sepId: string;
    inaCbg: string | null;
    tarifRs: number;
    tarifInaCbg: number | null;
    status: string;
    waktuKlaim: Date;
    noSep: string | null;
    diagnosa: string | null;
    pasien: string | null;
    rm: string | null;
    sumber: string | null;
}

const sepColumns = {
    id: sepRecords.id,
    visitId: sepRecords.visitId,
    noSep: sepRecords.noSep,
    noKartu: sepRecords.noKartu,
    diagnosa: sepRecords.diagnosa,
    tglSep: sepRecords.tglSep,
    ppkRujukan: sepRecords.ppkRujukan,
    status: sepRecords.status,
    sumber: sepRecords.sumber,
    pasien: patients.nama,
    rm: patients.rm,
    jaminan: visits.jaminan,
};

const klaimColumns = {
    id: bpjsClaims.id,
    sepId: bpjsClaims.sepId,
    inaCbg: bpjsClaims.inaCbg,
    tarifRs: bpjsClaims.tarifRs,
    tarifInaCbg: bpjsClaims.tarifInaCbg,
    status: bpjsClaims.status,
    waktuKlaim: bpjsClaims.waktuKlaim,
    noSep: sepRecords.noSep,
    diagnosa: sepRecords.diagnosa,
    pasien: patients.nama,
    rm: patients.rm,
    sumber: sepRecords.sumber,
};

/** Local (today) date as YYYY-MM-DD — the tglSep written to the SEP. */
const todayIso = (): string => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
};

/** Runs a port call, translating raw transport failures into 502. */
async function viaPort<T>(call: () => Promise<T>): Promise<T> {
    try {
        return await call();
    } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError(`BPJS VClaim: ${error instanceof Error ? error.message : 'permintaan gagal'}`, 502);
    }
}

// ─── Peserta ────────────────────────────────────────────────────────────────

export interface PesertaCheck {
    noKartu: string;
    nama: string;
    status: string;
    aktif: boolean;
    jenisPeserta?: string;
    kelas?: string;
    tglLahir?: string;
}

/** Card lookup — read-only, so it is allowed before a SEP is issued. */
export async function cekPeserta(port: VClaimPort, noKartu: string, tgl?: string): Promise<PesertaCheck> {
    const peserta: PesertaKartu = await viaPort(() => port.cekPeserta(noKartu.trim(), tgl || todayIso()));
    return { ...peserta, aktif: peserta.status.trim().toUpperCase() === 'AKTIF' };
}

// ─── SEP ────────────────────────────────────────────────────────────────────

/**
 * Issues one SEP for a BPJS Kunjungan and forms its Klaim in the same
 * transaction. The billing total is snapshotted into `tarifRs`; `inaCbg` stays
 * null (BPJS grouping is not available at issue time).
 */
export async function issueSep(db: Db, port: VClaimPort, input: IssueSepInput) {
    const noKartu = input.noKartu.trim();
    const diagnosa = input.diagnosa.trim();

    const [visit] = await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1);
    if (!visit) throw notFound('Kunjungan');
    if (visit.jaminan !== BPJS_JAMINAN) {
        throw new DomainError(`Kunjungan ini berjaminan "${visit.jaminan}", bukan ${BPJS_JAMINAN}`, 400);
    }
    if (!noKartu) throw new DomainError('Nomor kartu BPJS wajib diisi', 400);
    if (!diagnosa) throw new DomainError('Diagnosa awal wajib diisi', 400);

    // Nothing is stored until the peserta is proven AKTIF.
    const peserta = await cekPeserta(port, noKartu);
    if (!peserta.aktif) {
        throw new DomainError(`Peserta ${noKartu} berstatus ${peserta.status}, SEP tidak dapat diterbitkan`, 422);
    }

    const [aktif] = await db.select({ id: sepRecords.id }).from(sepRecords)
        .where(and(eq(sepRecords.visitId, visit.id), eq(sepRecords.status, 'aktif'))).limit(1);
    if (aktif) throw new DomainError('Kunjungan ini sudah memiliki SEP aktif', 409);

    const tglSep = todayIso();
    const inserted = await viaPort(() => port.insertSep({
        visitId: visit.id,
        noKartu,
        diagnosa,
        tglSep,
        ppkRujukan: input.ppkRujukan?.trim() || null,
    }));

    return db.transaction(async (tx) => {
        const [sep] = await tx.insert(sepRecords).values({
            id: nanoid(),
            visitId: visit.id,
            noSep: inserted.noSep,
            noKartu,
            diagnosa,
            tglSep: inserted.tglSep,
            ppkRujukan: input.ppkRujukan?.trim() || null,
            status: 'aktif',
            sumber: port.sumber,
        }).returning();

        const [billing] = await tx.select({ total: billings.total }).from(billings)
            .where(eq(billings.visitId, visit.id)).limit(1);

        const [klaim] = await tx.insert(bpjsClaims).values({
            id: nanoid(),
            sepId: sep.id,
            inaCbg: null,
            tarifRs: billing?.total ?? 0,
            tarifInaCbg: null,
            status: 'dibentuk',
        }).returning();

        return { sep, klaim };
    });
}

/** Cancels an aktif SEP through the port; the first write in the lifecycle. */
export async function batalSep(db: Db, port: VClaimPort, sepId: string) {
    const [sep] = await db.select().from(sepRecords).where(eq(sepRecords.id, sepId)).limit(1);
    if (!sep) throw notFound('SEP');
    assertTransition('sep', sep.status, 'batal');

    await viaPort(() => port.batalSep(sep.noSep));

    const [updated] = await db.update(sepRecords).set({ status: 'batal' })
        .where(and(eq(sepRecords.id, sep.id), eq(sepRecords.status, 'aktif'))).returning();
    if (!updated) throw new DomainError('SEP sudah tidak aktif', 409);
    return updated;
}

/** Moves a SEP to 'terpakai' (billing settled / patient discharged). */
export async function markSepTerpakai(db: Db, sepId: string) {
    const [sep] = await db.select().from(sepRecords).where(eq(sepRecords.id, sepId)).limit(1);
    if (!sep) throw notFound('SEP');
    assertTransition('sep', sep.status, 'terpakai');
    const [updated] = await db.update(sepRecords).set({ status: 'terpakai' }).where(eq(sepRecords.id, sep.id)).returning();
    return updated;
}

// ─── Klaim INA-CBG ──────────────────────────────────────────────────────────

const claimTransition = (from: string, to: unknown): void => assertTransition('klaim', from, to);

/** dibentuk → pending → layak | dispute → pending; anything else is a 409. */
export async function transitionKlaim(db: Db, klaimId: string, to: string) {
    const [klaim] = await db.select().from(bpjsClaims).where(eq(bpjsClaims.id, klaimId)).limit(1);
    if (!klaim) throw notFound('Klaim');
    claimTransition(klaim.status, to);

    const [updated] = await db.update(bpjsClaims).set({ status: to })
        .where(and(eq(bpjsClaims.id, klaim.id), eq(bpjsClaims.status, klaim.status))).returning();
    if (!updated) throw new DomainError('Status klaim berubah oleh proses lain, muat ulang', 409);
    return updated;
}

/**
 * Records the INA-CBG grouping returned by BPJS verification and moves the
 * claim from 'pending' to 'layak' in one step.
 */
export async function applyHasilVerifikasi(
    db: Db,
    klaimId: string,
    hasil: { inaCbg: string; tarifInaCbg: number },
) {
    const [klaim] = await db.select().from(bpjsClaims).where(eq(bpjsClaims.id, klaimId)).limit(1);
    if (!klaim) throw notFound('Klaim');
    claimTransition(klaim.status, 'layak');
    if (!hasil.inaCbg.trim()) throw new DomainError('Kode INA-CBG wajib diisi', 400);
    if (!Number.isInteger(hasil.tarifInaCbg) || hasil.tarifInaCbg < 0) {
        throw new DomainError('Tarif INA-CBG tidak valid', 400);
    }

    const [updated] = await db.update(bpjsClaims).set({
        inaCbg: hasil.inaCbg.trim(),
        tarifInaCbg: hasil.tarifInaCbg,
        status: 'layak',
    }).where(and(eq(bpjsClaims.id, klaim.id), eq(bpjsClaims.status, klaim.status))).returning();
    if (!updated) throw new DomainError('Status klaim berubah oleh proses lain, muat ulang', 409);
    return updated;
}

// ─── Lists ──────────────────────────────────────────────────────────────────

/** SEP list for the registration desk: search pasien / RM / noSEP, per-status counts. */
export async function listSeps(db: Db, params: PageParams): Promise<Page<SepRow>> {
    const search: SQL | undefined = params.q
        ? or(ilike(patients.nama, `%${params.q}%`), ilike(patients.rm, `%${params.q}%`), ilike(sepRecords.noSep, `%${params.q}%`))
        : undefined;

    const [rows, statusRows] = await Promise.all([
        db.select(sepColumns).from(sepRecords)
            .leftJoin(visits, eq(sepRecords.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(and(search, params.status ? eq(sepRecords.status, params.status) : undefined))
            .orderBy(desc(sepRecords.tglSep))
            .limit(params.limit).offset(params.offset),
        db.select({ status: sepRecords.status, n: count() }).from(sepRecords)
            .leftJoin(visits, eq(sepRecords.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(search).groupBy(sepRecords.status),
    ]);

    const counts = countsByStatus(statusRows);
    const total = params.status ? (counts[params.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    return toPage(rows as SepRow[], total, params, counts);
}

/** Klaim list for billing: search pasien / RM / noSEP, per-status counts. */
export async function listKlaims(db: Db, params: PageParams): Promise<Page<KlaimRow>> {
    const search: SQL | undefined = params.q
        ? or(ilike(patients.nama, `%${params.q}%`), ilike(patients.rm, `%${params.q}%`), ilike(sepRecords.noSep, `%${params.q}%`))
        : undefined;

    const [rows, statusRows] = await Promise.all([
        db.select(klaimColumns).from(bpjsClaims)
            .leftJoin(sepRecords, eq(bpjsClaims.sepId, sepRecords.id))
            .leftJoin(visits, eq(sepRecords.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(and(search, params.status ? eq(bpjsClaims.status, params.status) : undefined))
            .orderBy(desc(bpjsClaims.waktuKlaim))
            .limit(params.limit).offset(params.offset),
        db.select({ status: bpjsClaims.status, n: count() }).from(bpjsClaims)
            .leftJoin(sepRecords, eq(bpjsClaims.sepId, sepRecords.id))
            .leftJoin(visits, eq(sepRecords.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(search).groupBy(bpjsClaims.status),
    ]);

    const counts = countsByStatus(statusRows);
    const total = params.status ? (counts[params.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    return toPage(rows as KlaimRow[], total, params, counts);
}

/** SEP + its claim for one Kunjungan — the SEP form's "sudah terbit?" lookup. */
export async function getSepByVisit(db: Db, visitId: string) {
    const [sep] = await db.select(sepColumns).from(sepRecords)
        .leftJoin(visits, eq(sepRecords.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(sepRecords.visitId, visitId)).orderBy(desc(sepRecords.tglSep)).limit(1);
    if (!sep) throw notFound('SEP');

    const [klaim] = await db.select(klaimColumns).from(bpjsClaims)
        .leftJoin(sepRecords, eq(bpjsClaims.sepId, sepRecords.id))
        .leftJoin(visits, eq(sepRecords.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(bpjsClaims.sepId, sep.id)).limit(1);

    return { sep: sep as SepRow, klaim: (klaim as KlaimRow | undefined) ?? null };
}

/** Read-only visit summary for the SEP form (no VClaim call). */
export async function getVisitForSep(db: Db, visitId: string) {
    const [row] = await db.select({
        id: visits.id,
        patientId: visits.patientId,
        pasien: patients.nama,
        rm: patients.rm,
        jaminan: visits.jaminan,
        poli: visits.poliId,
        tipeKunjungan: visits.tipeKunjungan,
        status: visits.status,
    }).from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(visits.id, visitId)).limit(1);
    if (!row) throw notFound('Kunjungan');
    return row;
}
