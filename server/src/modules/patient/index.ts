import { Router } from 'express';
import { db } from '../../db';
import { patients, visits } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { eq, max, and, gte, lt, isNull, ilike, or } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { queues } from '../../db/schemas/schedule';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { ROLE_GROUPS } from '../../utils/roles';
import { createPatientSchema, createVisitSchema, patientRmParamSchema, updatePatientSchema, visitIdParamSchema } from './schema';

const router = Router();

const patientReadRoles = [...ROLE_GROUPS.registration, ...ROLE_GROUPS.clinical, ...ROLE_GROUPS.billing, ...ROLE_GROUPS.pharmacy, ...ROLE_GROUPS.lab];
const patientWriteRoles = ROLE_GROUPS.registration;

// GET all visits (registrations) — keep before /:rm
router.get('/visits/all', requireAuth, requireRole(...patientReadRoles), asyncHandler(async (req, res) => {
    const data = await db.select({
        id: visits.id,
        nama: patients.nama,
        nik: patients.nik,
        jaminan: visits.jaminan,
        poli: visits.poliId,
        dokter: users.name,
        status: visits.status,
        waktu: visits.waktuDaftar,
        rm: patients.rm,
        tipe: visits.tipeKunjungan
    })
        .from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .leftJoin(users, eq(visits.dokterId, users.id));

    res.json(data);
}));

// POST new visit (registration)
router.post('/visits', requireAuth, requireRole(...patientWriteRoles), validate(createVisitSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const visit = await db.transaction(async (tx) => {
        const newVisit = await tx.insert(visits).values({
            id: body.id || `VIS-${Date.now()}`,
            patientId: body.patientId,
            poliId: body.poliId,
            dokterId: body.dokterId,
            jaminan: body.jaminan,
            status: body.status || 'menunggu',
            tipeKunjungan: body.tipeKunjungan,
        }).returning();

        const createdVisit = newVisit[0];

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const poliPrefixes: Record<string, string> = {
            'Poli Umum': 'A',
            'Poli Gigi': 'B',
            'Poli Anak': 'C',
            'Poli Kandungan': 'D',
            'IGD': 'E'
        };
        const queueCode = poliPrefixes[createdVisit.poliId] || 'P';

        const queueStats = await tx.select({ maxNum: max(queues.queueNumber) })
            .from(queues)
            .where(
                and(
                    eq(queues.poliId, createdVisit.poliId),
                    gte(queues.createdAt, startOfDay),
                    lt(queues.createdAt, endOfDay)
                )
            );
        const nextNumber = (queueStats[0]?.maxNum || 0) + 1;

        await tx.insert(queues).values({
            visitId: createdVisit.id,
            poliId: createdVisit.poliId,
            loket: createdVisit.poliId,
            queueNumber: nextNumber,
            queueCode: `${queueCode}-${String(nextNumber).padStart(3, '0')}`,
            status: 'menunggu'
        });

        return createdVisit;
    });

    // Fetch the queue row after the transaction commits so the response can print a ticket.
    const queueRow = await db.select({ queueCode: queues.queueCode, loket: queues.loket })
        .from(queues)
        .where(eq(queues.visitId, visit.id))
        .limit(1);

    res.status(201).json({ ...visit, queueCode: queueRow[0]?.queueCode ?? null, loket: queueRow[0]?.loket ?? null });
}));

// DELETE visit (registration) soft delete
router.delete('/visits/:id', requireAuth, requireRole(...patientWriteRoles), validate(visitIdParamSchema), asyncHandler(async (req, res) => {
    await db.update(visits).set({ status: 'batal' }).where(eq(visits.id, req.params.id));
    res.json({ success: true, message: 'Visit cancelled successfully' });
}));

// GET all patients — optional ?q= searches ilike across nama OR rm OR nik.
// Without q the full (non-deleted) list is returned, unchanged.
router.get('/', requireAuth, requireRole(...patientReadRoles), asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where = q
        ? and(
            isNull(patients.deletedAt),
            or(
                ilike(patients.nama, `%${q}%`),
                ilike(patients.rm, `%${q}%`),
                ilike(patients.nik, `%${q}%`),
            ),
        )
        : isNull(patients.deletedAt);

    const allPatients = await db.select().from(patients).where(where);
    res.json(allPatients);
}));

// POST new patient
router.post('/', requireAuth, requireRole(...patientWriteRoles), validate(createPatientSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    const newPatient = await db.insert(patients).values({
        id: body.id || `PAT-${Date.now()}`,
        rm: body.rm,
        nik: body.nik,
        nama: body.nama,
        tempatLahir: body.tempatLahir,
        tanggalLahir: body.tanggalLahir,
        gender: body.gender,
        goldar: body.goldar,
        agama: body.agama,
        alamat: body.alamat,
        telepon: body.telepon,
        pekerjaan: body.pekerjaan,
        alergi: body.alergi,
    }).returning();
    res.status(201).json(newPatient[0]);
}));

// GET patient by RM
router.get('/:rm', requireAuth, requireRole(...patientReadRoles), validate(patientRmParamSchema), asyncHandler(async (req, res) => {
    const patient = await db.select().from(patients).where(and(eq(patients.rm, req.params.rm), isNull(patients.deletedAt)));
    if (!patient.length) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient[0]);
}));

// PUT update patient by RM
router.put('/:rm', requireAuth, requireRole(...patientWriteRoles), validate(updatePatientSchema), asyncHandler(async (req, res) => {
    const body = req.body;
    await db.update(patients).set({
        nik: body.nik,
        nama: body.nama,
        tempatLahir: body.tempatLahir,
        tanggalLahir: body.tanggalLahir,
        gender: body.gender,
        goldar: body.goldar,
        agama: body.agama,
        alamat: body.alamat,
        telepon: body.telepon,
        pekerjaan: body.pekerjaan,
        alergi: body.alergi,
        updatedAt: new Date()
    }).where(eq(patients.rm, req.params.rm));
    res.json({ success: true });
}));

// DELETE patient (Soft Delete)
router.delete('/:rm', requireAuth, requireRole(...patientWriteRoles), validate(patientRmParamSchema), asyncHandler(async (req, res) => {
    await db.update(patients).set({ deletedAt: new Date() }).where(eq(patients.rm, req.params.rm));
    res.json({ success: true, message: 'Patient logically deleted' });
}));

export const patientRouter = router;
