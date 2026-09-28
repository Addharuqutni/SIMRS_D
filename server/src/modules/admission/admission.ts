/**
 * Admission — the only way a patient enters the hospital (Kunjungan).
 *
 *   admit()               rawat_jalan | igd | rawat_inap
 *   transitionKunjungan() visit status via the shared 'kunjungan' lifecycle
 *   transitionAdmisi()    rawat-inap status; 'pulang' charges the room once
 *
 * One transaction creates (optionally) the patient with a server-issued RM,
 * the visit, its Antrean ticket, the IGD triase or rawat-inap admisi row, and
 * the first billing charge. Queue changes are broadcast after commit.
 */
import { and, eq, gte, inArray, lt, max, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db, DbOrTx } from '../../db/types';
import { patients, visits } from '../../db/schemas/patient';
import { queues } from '../../db/schemas/schedule';
import { igdTriase, rawatInapAdmisi } from '../../db/schemas/clinical';
import { users } from '../../db/schemas/auth';
import { notifications } from '../../db/schemas/notify';
import { DOCTOR_ROLES } from '../../../../shared/access';
import { POLI_PREFIX, type AdmitInput } from '../../../../shared/admission';
import { DomainError, notFound } from '../../utils/domain-error';
import { assertTransition } from '../../utils/transition';
import { computeMews } from '../../utils/mews';
import { emitQueueUpdate } from '../../utils/websocket';
import { charge } from '../billing/ledger';
import { getRoomTariffs, getServiceTariffs } from '../settings';

export type { AdmitInput };

const POLI_OF = { igd: 'IGD', rawat_inap: 'Rawat Inap' } as const;

/** Next RM: sequential `RM` + 6 digits. Serialized by a transaction-scoped advisory lock. */
async function nextRm(tx: DbOrTx): Promise<string> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('patients.rm'))`);
    const [row] = await tx.select({ n: sql<number>`coalesce(max(substring(${patients.rm} from 3)::int), 0)` })
        .from(patients)
        .where(sql`${patients.rm} ~ '^RM[0-9]{6,}$'`);
    return `RM${String(Number(row.n) + 1).padStart(6, '0')}`;
}

/** Day-scoped queue number per poli, e.g. A-007. Serialized per poli. */
async function issueQueue(tx: DbOrTx, visitId: string, poliId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'queues:' + poliId}))`);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const [{ maxNum }] = await tx.select({ maxNum: max(queues.queueNumber) }).from(queues)
        .where(and(eq(queues.poliId, poliId), gte(queues.createdAt, start), lt(queues.createdAt, end)));
    const queueNumber = (maxNum ?? 0) + 1;
    const [queue] = await tx.insert(queues).values({
        visitId, poliId, loket: poliId, queueNumber,
        queueCode: `${POLI_PREFIX[poliId] ?? 'P'}-${String(queueNumber).padStart(3, '0')}`,
        status: 'menunggu',
    }).returning();
    return queue;
}

async function assertDoctor(tx: DbOrTx, dokterId: string) {
    const [doc] = await tx.select({ id: users.id, name: users.name }).from(users)
        .where(and(eq(users.id, dokterId), inArray(users.role, [...DOCTOR_ROLES]))).limit(1);
    if (!doc) throw new DomainError('Dokter tidak ditemukan atau bukan dokter', 400);
    return doc;
}

export async function admit(db: Db, input: AdmitInput) {
    const poliId = input.jenis === 'rawat_jalan' ? input.poliId : POLI_OF[input.jenis];
    const tariffs = await getServiceTariffs(db);

    const result = await db.transaction(async (tx) => {
        const doctor = await assertDoctor(tx, input.dokterId);

        let patient;
        if (input.patientId) {
            [patient] = await tx.select().from(patients).where(eq(patients.id, input.patientId)).limit(1);
            if (!patient || patient.deletedAt) throw new DomainError('Pasien tidak ditemukan', 400);
        } else {
            const p = input.pasienBaru!;
            if (p.nik) {
                const [dup] = await tx.select({ rm: patients.rm }).from(patients).where(eq(patients.nik, p.nik)).limit(1);
                if (dup) throw new DomainError(`NIK sudah terdaftar dengan RM ${dup.rm}`, 409);
            }
            [patient] = await tx.insert(patients).values({ id: nanoid(), rm: await nextRm(tx), ...p }).returning();
        }

        const [visit] = await tx.insert(visits).values({
            id: nanoid(), patientId: patient.id, poliId, dokterId: doctor.id,
            jaminan: input.jaminan, tipeKunjungan: input.jenis, status: 'menunggu',
        }).returning();

        const queue = await issueQueue(tx, visit.id, poliId);

        let mews;
        if (input.jenis === 'igd') {
            mews = computeMews(input.vitals ?? {});
            await tx.insert(igdTriase).values({
                id: nanoid(), visitId: visit.id, triase: input.triase, keluhanUtama: input.keluhanUtama,
                ...input.vitals, mewsScore: mews.score,
            });
            if (mews.score >= 3) {
                await tx.insert(notifications).values({
                    userId: doctor.id,
                    title: `MEWS ${mews.score} — Pasien IGD Kritis`,
                    message: `Pasien ${patient.nama} (Triase ${input.triase.toUpperCase()}) menunjukkan tanda deteriorasi. ${mews.action}`,
                    type: mews.level === 'danger' ? 'error' : 'warning',
                    linkUrl: '/igd',
                });
            }
        }
        if (input.jenis === 'rawat_inap') {
            await tx.insert(rawatInapAdmisi).values({
                id: nanoid(), visitId: visit.id, ruanganId: input.ruanganId, kelas: input.kelas, status: 'dirawat',
            });
        }

        if (input.jenis !== 'rawat_inap') {
            await charge(tx, {
                visitId: visit.id,
                kategori: input.jenis === 'igd' ? 'Tindakan' : 'Poli',
                namaItem: input.jenis === 'igd' ? 'Pelayanan IGD' : `Konsultasi Dokter — ${poliId}`,
                harga: input.jenis === 'igd' ? tariffs.konsultasiIgd : tariffs.konsultasiPoli,
                sourceRef: `KUNJUNGAN:${visit.id}`,
            });
        }

        return { patient, visit, queue, mews };
    });

    emitQueueUpdate(poliId, { visitId: result.visit.id, queueCode: result.queue.queueCode, status: 'menunggu' });
    return result;
}

export async function transitionKunjungan(db: Db, visitId: string, to: string) {
    const result = await db.transaction(async (tx) => {
        const [visit] = await tx.select().from(visits).where(eq(visits.id, visitId)).for('update');
        if (!visit) throw notFound('Kunjungan');
        assertTransition('kunjungan', visit.status, to);

        const done = to === 'selesai' || to === 'batal';
        const [updated] = await tx.update(visits)
            .set({ status: to, ...(done ? { waktuSelesai: new Date() } : {}) })
            .where(eq(visits.id, visitId)).returning();

        const queueStatus = to === 'batal' ? 'batal' : to === 'selesai' ? 'selesai' : to === 'menunggu' ? null : 'diperiksa';
        if (queueStatus) {
            await tx.update(queues)
                .set({ status: queueStatus, ...(done ? { finishedAt: new Date() } : {}) })
                .where(eq(queues.visitId, visitId));
        }
        return updated;
    });
    emitQueueUpdate(result.poliId, { visitId, status: result.status });
    return result;
}

const MS_PER_DAY = 86_400_000;

export async function transitionAdmisi(db: Db, admisiId: string, to: string) {
    const rooms = await getRoomTariffs(db);
    return db.transaction(async (tx) => {
        const [admisi] = await tx.select().from(rawatInapAdmisi).where(eq(rawatInapAdmisi.id, admisiId)).for('update');
        if (!admisi) throw notFound('Admisi rawat inap');
        assertTransition('admisi', admisi.status, to);

        const waktuKeluar = to === 'pulang' ? new Date() : null;
        const [updated] = await tx.update(rawatInapAdmisi)
            .set({ status: to, waktuKeluar })
            .where(eq(rawatInapAdmisi.id, admisiId)).returning();

        if (waktuKeluar) {
            const tarif = rooms[admisi.kelas];
            if (tarif === undefined) throw new DomainError(`Tarif kamar untuk kelas "${admisi.kelas}" belum diatur`, 422);
            const days = Math.max(1, Math.ceil((waktuKeluar.getTime() - admisi.waktuMasuk.getTime()) / MS_PER_DAY));
            await charge(tx, {
                visitId: admisi.visitId,
                kategori: 'Rawat Inap',
                namaItem: `Kamar ${admisi.ruanganId} (${admisi.kelas}) × ${days} hari`,
                harga: tarif,
                jumlah: days,
                sourceRef: `KAMAR:${admisi.id}`,
            });
            await tx.update(visits).set({ status: 'selesai', waktuSelesai: waktuKeluar }).where(eq(visits.id, admisi.visitId));
        }
        return updated;
    });
}
