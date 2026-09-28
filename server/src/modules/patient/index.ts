import { Router } from 'express';
import { db } from '../../db';
import { patients, visits } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { queues } from '../../db/schemas/schedule';
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import type { Capability } from '../../../../shared/access';
import { countsByStatus, readPageParams, toPage } from '../../utils/pagination';
import { admit, transitionKunjungan, type AdmitInput } from '../admission/admission';
import { admitRawatJalanSchema } from '../admission/schema';
import { patientRmParamSchema, updatePatientSchema, visitIdParamSchema } from './schema';

const router = Router();

const patientReadRoles: Capability[] = ['registration', 'clinical', 'billing', 'pharmacy', 'lab'];
const patientWriteRoles: Capability[] = ['registration'];

// GET registrations (all Kunjungan types) — paginated, per-status counts; ?jaminan= filters. Keep before /:rm
router.get('/visits/all', requireAuth, requireRole(...patientReadRoles), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const jaminan = typeof req.query.jaminan === 'string' && req.query.jaminan ? req.query.jaminan : undefined;
    const filter = and(
        p.q ? or(ilike(patients.nama, `%${p.q}%`), ilike(patients.rm, `%${p.q}%`), ilike(patients.nik, `%${p.q}%`)) : undefined,
        jaminan ? eq(visits.jaminan, jaminan) : undefined,
    );

    const [rows, statusRows] = await Promise.all([
        db.select({
            id: visits.id,
            patientId: patients.id,
            nama: patients.nama,
            nik: patients.nik,
            jaminan: visits.jaminan,
            poli: visits.poliId,
            dokter: users.name,
            status: visits.status,
            waktu: visits.waktuDaftar,
            rm: patients.rm,
            tipe: visits.tipeKunjungan,
            queueCode: queues.queueCode,
        })
            .from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id))
            .leftJoin(queues, eq(queues.visitId, visits.id))
            .where(and(filter, p.status ? eq(visits.status, p.status) : undefined))
            .orderBy(desc(visits.waktuDaftar))
            .limit(p.limit).offset(p.offset),
        db.select({ status: visits.status, n: count() }).from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(filter).groupBy(visits.status),
    ]);
    const counts = countsByStatus(statusRows);
    const total = p.status ? (counts[p.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    res.json(toPage(rows, total, p, counts));
}));

// POST registration (rawat jalan) — patient (new or existing) + visit + Antrean ticket + konsultasi charge
router.post('/visits', requireAuth, requireRole(...patientWriteRoles), validate(admitRawatJalanSchema), asyncHandler(async (req, res) => {
    const r = await admit(db, { jenis: 'rawat_jalan', ...req.body } as AdmitInput);
    res.status(201).json({ ...r.visit, rm: r.patient.rm, nama: r.patient.nama, queueCode: r.queue.queueCode, loket: r.queue.loket });
}));

// DELETE registration → Kunjungan batal (queue ticket cancelled too)
router.delete('/visits/:id', requireAuth, requireRole(...patientWriteRoles), validate(visitIdParamSchema), asyncHandler(async (req, res) => {
    await transitionKunjungan(db, req.params.id, 'batal');
    res.json({ success: true });
}));

// GET patients — optional ?q= searches nama / rm / nik; capped at 50 rows (picker use)
router.get('/', requireAuth, requireRole(...patientReadRoles), asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where = and(
        isNull(patients.deletedAt),
        q ? or(ilike(patients.nama, `%${q}%`), ilike(patients.rm, `%${q}%`), ilike(patients.nik, `%${q}%`)) : undefined,
    );
    res.json(await db.select().from(patients).where(where).orderBy(desc(patients.createdAt)).limit(50));
}));

// GET patient by RM
router.get('/:rm', requireAuth, requireRole(...patientReadRoles), validate(patientRmParamSchema), asyncHandler(async (req, res) => {
    const patient = await db.select().from(patients).where(and(eq(patients.rm, req.params.rm), isNull(patients.deletedAt)));
    if (!patient.length) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient[0]);
}));

// PUT update patient by RM
router.put('/:rm', requireAuth, requireRole(...patientWriteRoles), validate(updatePatientSchema), asyncHandler(async (req, res) => {
    await db.update(patients).set({ ...req.body, updatedAt: new Date() }).where(eq(patients.rm, req.params.rm));
    res.json({ success: true });
}));

// DELETE patient (Soft Delete)
router.delete('/:rm', requireAuth, requireRole(...patientWriteRoles), validate(patientRmParamSchema), asyncHandler(async (req, res) => {
    await db.update(patients).set({ deletedAt: new Date() }).where(eq(patients.rm, req.params.rm));
    res.json({ success: true, message: 'Patient logically deleted' });
}));

export const patientRouter = router;
