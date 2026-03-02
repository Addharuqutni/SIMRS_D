import { Router } from 'express';
import { db } from '../../db';
import { patients, visits } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { eq, sql, max, and, gte, lt } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';
import { queues } from '../../db/schemas/schedule';

const router = Router();

// GET all patients
router.get('/', requireAuth, async (req, res) => {
    try {
        const allPatients = await db.select().from(patients);
        res.json(allPatients);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch patients', details: error.message });
    }
});

// POST new patient
router.post('/', requireAuth, async (req, res) => {
    try {
        const newPatient = await db.insert(patients).values(req.body).returning();
        res.status(201).json(newPatient[0]);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create patient', details: error.message });
    }
});

// GET patient by RM
router.get('/:rm', requireAuth, async (req, res) => {
    try {
        const rmParam = req.params.rm as string;
        const patient = await db.select().from(patients).where(eq(patients.rm, rmParam));
        if (!patient.length) return res.status(404).json({ error: 'Patient not found' });
        res.json(patient[0]);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch patient', details: error.message });
    }
});

// PUT update patient by RM
router.put('/:rm', requireAuth, async (req, res) => {
    try {
        const rmParam = req.params.rm as string;
        await db.update(patients).set({ ...req.body, updatedAt: new Date() }).where(eq(patients.rm, rmParam));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update patient', details: error.message });
    }
});

// DELETE patient (Soft Delete)
router.delete('/:rm', requireAuth, async (req, res) => {
    try {
        const rmParam = req.params.rm as string;
        await db.update(patients).set({ deletedAt: new Date() }).where(eq(patients.rm, rmParam));
        res.json({ success: true, message: 'Patient logically deleted' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete patient', details: error.message });
    }
});

// GET all visits (registrations)
router.get('/visits/all', requireAuth, async (req, res) => {
    try {
        // Simple join to get visit + patient info
        const data = await db.select({
            id: visits.id,
            nama: patients.nama,
            nik: patients.nik,
            jaminan: visits.jaminan,
            poli: visits.poliId,
            dokter: users.name,
            status: visits.status,
            waktu: visits.waktuDaftar,
            rm: patients.rm
        })
            .from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id));

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch visits', details: error.message });
    }
});

// POST new visit (registration)
router.post('/visits', requireAuth, async (req, res) => {
    try {
        const newVisit = await db.insert(visits).values(req.body).returning();
        const visit = newVisit[0];

        // Also generate a Queue ticket (Antrean) for this visit
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Map poli to a queue code letter
        const poliPrefixes: Record<string, string> = {
            'Poli Umum': 'A',
            'Poli Gigi': 'B',
            'Poli Anak': 'C',
            'Poli Kandungan': 'D',
            'IGD': 'E'
        };
        const queueCode = poliPrefixes[visit.poliId] || 'P';

        // Calculate next queue number for this poli today
        const queueStats = await db.select({ maxNum: max(queues.queueNumber) })
            .from(queues)
            .where(
                and(
                    eq(queues.poliId, visit.poliId),
                    gte(queues.createdAt, startOfDay),
                    lt(queues.createdAt, endOfDay)
                )
            );
        const nextNumber = (queueStats[0]?.maxNum || 0) + 1;

        await db.insert(queues).values({
            visitId: visit.id,
            poliId: visit.poliId,
            loket: visit.poliId,
            queueNumber: nextNumber,
            queueCode: `${queueCode}-${String(nextNumber).padStart(3, '0')}`,
            status: 'menunggu'
        });

        res.status(201).json(visit);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create visit registration', details: error.message });
    }
});

// DELETE visit (registration) soft delete
router.delete('/visits/:id', requireAuth, async (req, res) => {
    try {
        const visitId = req.params.id as string;
        await db.update(visits).set({ status: 'batal' }).where(eq(visits.id, visitId));
        res.json({ success: true, message: 'Visit cancelled successfully' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete visit', details: error.message });
    }
});

export const patientRouter = router;
