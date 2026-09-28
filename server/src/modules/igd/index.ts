import { Router } from 'express';
import { db } from '../../db';
import { igdTriase } from '../../db/schemas/clinical';
import { visits, patients } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { mewsActionFor } from '../../utils/mews';
import { countsByStatus, readPageParams, toPage } from '../../utils/pagination';
import { admit, transitionKunjungan, type AdmitInput } from '../admission/admission';
import { admitIgdSchema, statusSchema } from '../admission/schema';

const router = Router();

// GET IGD visits — paginated, per-status counts
router.get('/', requireAuth, requireRole('clinical'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const search = p.q ? or(ilike(patients.nama, `%${p.q}%`), ilike(patients.rm, `%${p.q}%`)) : undefined;
    const isIgd = eq(visits.tipeKunjungan, 'igd');

    const [rows, statusRows] = await Promise.all([
        db.select({
            rm: patients.rm,
            pasien: patients.nama,
            triase: igdTriase.triase,
            keluhanUtama: igdTriase.keluhanUtama,
            masuk: visits.waktuDaftar,
            dokter: users.name,
            status: visits.status,
            visitId: visits.id,
            mewsScore: igdTriase.mewsScore,
            alergi: patients.alergi,
            patientId: patients.id,
        }).from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id))
            .leftJoin(igdTriase, eq(visits.id, igdTriase.visitId))
            .where(and(isIgd, search, p.status ? eq(visits.status, p.status) : undefined))
            .orderBy(desc(visits.waktuDaftar))
            .limit(p.limit).offset(p.offset),
        db.select({ status: visits.status, n: count() }).from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(and(isIgd, search)).groupBy(visits.status),
    ]);

    const counts = countsByStatus(statusRows);
    const total = p.status ? (counts[p.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    res.json(toPage(rows.map((r) => ({
        ...r,
        mews: mewsActionFor(r.mewsScore ?? 0),
        hasAllergy: !!(r.alergi && r.alergi.trim() && r.alergi.trim().toLowerCase() !== 'tidak ada'),
    })), total, p, counts));
}));

// POST IGD admission — patient (new or existing), visit, queue, triase + MEWS, IGD charge
router.post('/admisi', requireAuth, requireRole('clinical'), validate(admitIgdSchema), asyncHandler(async (req, res) => {
    const r = await admit(db, { jenis: 'igd', ...req.body } as AdmitInput);
    res.status(201).json({ visitId: r.visit.id, rm: r.patient.rm, queueCode: r.queue.queueCode, mewsScore: r.mews?.score, mews: r.mews });
}));

// PUT IGD Kunjungan status (menunggu → tindakan → observasi → selesai)
router.put('/tindakan/:visitId', requireAuth, requireRole('clinical'), validate(statusSchema), asyncHandler(async (req, res) => {
    res.json(await transitionKunjungan(db, req.params.visitId, req.body.status));
}));

export const igdRouter = router;
