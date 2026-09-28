import { Router } from 'express';
import { db } from '../../db';
import { rawatInapAdmisi, emrSoap } from '../../db/schemas/clinical';
import { visits, patients } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { and, count, desc, eq, ilike, ne, or } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { countsByStatus, readPageParams, toPage } from '../../utils/pagination';
import { notFound } from '../../utils/domain-error';
import { admit, transitionAdmisi, transitionKunjungan, type AdmitInput } from '../admission/admission';
import { admitRawatInapSchema, statusSchema } from '../admission/schema';

const router = Router();

const kunjunganColumns = {
    id: visits.id,
    patientId: patients.id,
    nama: patients.nama,
    rm: patients.rm,
    alergi: patients.alergi,
    poli: visits.poliId,
    dokter: users.name,
    dokterId: visits.dokterId,
    jaminan: visits.jaminan,
    status: visits.status,
    waktu: visits.waktuDaftar,
};

// ==========================================
// RAWAT JALAN
// ==========================================

// GET rawat jalan visits — paginated, per-status counts
router.get('/rawat-jalan', requireAuth, requireRole('clinical'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const isRajal = eq(visits.tipeKunjungan, 'rawat_jalan');
    const search = p.q ? or(ilike(patients.nama, `%${p.q}%`), ilike(patients.rm, `%${p.q}%`), ilike(visits.poliId, `%${p.q}%`)) : undefined;

    const [rows, statusRows] = await Promise.all([
        db.select(kunjunganColumns).from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id))
            .where(and(isRajal, search, p.status ? eq(visits.status, p.status) : undefined))
            .orderBy(desc(visits.waktuDaftar))
            .limit(p.limit).offset(p.offset),
        db.select({ status: visits.status, n: count() }).from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(and(isRajal, search)).groupBy(visits.status),
    ]);
    const counts = countsByStatus(statusRows);
    const total = p.status ? (counts[p.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    res.json(toPage(rows, total, p, counts));
}));

// GET one Kunjungan (deep-linkable EMR context)
router.get('/rawat-jalan/:id', requireAuth, requireRole('clinical'), asyncHandler(async (req, res) => {
    const [row] = await db.select(kunjunganColumns).from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .leftJoin(users, eq(visits.dokterId, users.id))
        .where(eq(visits.id, req.params.id))
        .limit(1);
    if (!row) throw notFound('Kunjungan');
    res.json(row);
}));

// GET previous Kunjungan of the same patient (Riwayat tab), newest first
router.get('/rawat-jalan/:id/riwayat', requireAuth, requireRole('clinical'), asyncHandler(async (req, res) => {
    const [current] = await db.select({ patientId: visits.patientId }).from(visits).where(eq(visits.id, req.params.id)).limit(1);
    if (!current) throw notFound('Kunjungan');
    const rows = await db.select({
        id: visits.id,
        waktu: visits.waktuDaftar,
        poli: visits.poliId,
        tipe: visits.tipeKunjungan,
        dokter: users.name,
        status: visits.status,
        asesmen: emrSoap.asesmen,
        planning: emrSoap.planning,
        icd10Codes: emrSoap.icd10Codes,
    }).from(visits)
        .leftJoin(users, eq(visits.dokterId, users.id))
        .leftJoin(emrSoap, eq(emrSoap.visitId, visits.id))
        .where(and(eq(visits.patientId, current.patientId), ne(visits.id, req.params.id)))
        .orderBy(desc(visits.waktuDaftar))
        .limit(50);
    res.json(rows);
}));

// PUT rawat jalan status (menunggu → pemeriksaan → selesai)
router.put('/rawat-jalan/:id/status', requireAuth, requireRole('clinical'), validate(statusSchema), asyncHandler(async (req, res) => {
    res.json(await transitionKunjungan(db, req.params.id, req.body.status));
}));

// ==========================================
// RAWAT INAP (ADMISI)
// ==========================================

// GET rawat inap patients — paginated, per-status counts
router.get('/rawat-inap', requireAuth, requireRole('clinical'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const search = p.q ? or(ilike(patients.nama, `%${p.q}%`), ilike(patients.rm, `%${p.q}%`), ilike(rawatInapAdmisi.ruanganId, `%${p.q}%`)) : undefined;

    const [rows, statusRows] = await Promise.all([
        db.select({
            id: rawatInapAdmisi.id,
            visitId: visits.id,
            rm: patients.rm,
            pasien: patients.nama,
            ruangan: rawatInapAdmisi.ruanganId,
            kelas: rawatInapAdmisi.kelas,
            masuk: rawatInapAdmisi.waktuMasuk,
            keluar: rawatInapAdmisi.waktuKeluar,
            dpjp: users.name,
            jaminan: visits.jaminan,
            status: rawatInapAdmisi.status,
        }).from(rawatInapAdmisi)
            .leftJoin(visits, eq(rawatInapAdmisi.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id))
            .where(and(search, p.status ? eq(rawatInapAdmisi.status, p.status) : undefined))
            .orderBy(desc(rawatInapAdmisi.waktuMasuk))
            .limit(p.limit).offset(p.offset),
        db.select({ status: rawatInapAdmisi.status, n: count() }).from(rawatInapAdmisi)
            .leftJoin(visits, eq(rawatInapAdmisi.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(search).groupBy(rawatInapAdmisi.status),
    ]);
    const counts = countsByStatus(statusRows);
    const total = p.status ? (counts[p.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    res.json(toPage(rows, total, p, counts));
}));

// POST rawat inap admission
router.post('/rawat-inap/admisi', requireAuth, requireRole('clinical', 'registration'), validate(admitRawatInapSchema), asyncHandler(async (req, res) => {
    const r = await admit(db, { jenis: 'rawat_inap', ...req.body } as AdmitInput);
    res.status(201).json({ visitId: r.visit.id, rm: r.patient.rm });
}));

// PUT rawat inap status (dirawat / kritis / rencana_pulang / pulang — pulang bills the room)
router.put('/rawat-inap/:id/status', requireAuth, requireRole('clinical'), validate(statusSchema), asyncHandler(async (req, res) => {
    res.json(await transitionAdmisi(db, req.params.id, req.body.status));
}));

export const kunjunganRouter = router;
