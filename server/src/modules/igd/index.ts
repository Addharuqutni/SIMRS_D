import { Router } from 'express';
import { db } from '../../db';
import { igdTriase } from '../../db/schemas/clinical';
import { visits, patients } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// GET all active IGD visits
router.get('/', requireAuth, async (req, res) => {
    try {
        const data = await db.select({
            rm: patients.rm,
            pasien: patients.nama,
            triase: igdTriase.triase,
            keluhanUtama: igdTriase.keluhanUtama,
            masuk: visits.waktuDaftar,
            diagnosaAwal: igdTriase.keluhanUtama, // matching frontend expectations initially
            dokter: users.name,
            status: visits.status,
            visitId: visits.id
        }).from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id))
            .leftJoin(igdTriase, eq(visits.id, igdTriase.visitId))
            .where(eq(visits.poliId, 'IGD')) // assuming 'IGD' represents the poliId for emergency room
            .orderBy(desc(visits.waktuDaftar));

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch IGD data', details: error.message });
    }
});

// POST new IGD admission (creates patient, visit, and triase)
router.post('/admisi', requireAuth, async (req, res) => {
    try {
        // Since IGD frontend currently sends: { pasien, triase, diagnosaAwal, dokter }
        // We simulate creating the chained records here. In a real scenario, patient RM might exist.

        let generatedRM = `RM${Math.floor(100000 + Math.random() * 900000)}`;

        const newPatient = await db.insert(patients).values({
            id: `PAT-${Date.now()}`,
            rm: generatedRM,
            nama: req.body.pasien,
            gender: 'L', // default placeholder
            alamat: 'Darurat IGD'
        }).returning();

        const newVisit = await db.insert(visits).values({
            id: `VST-${Date.now()}`,
            patientId: newPatient[0].id,
            poliId: 'IGD',
            dokterId: req.body.dokter,
            jaminan: 'Umum / Mandiri',
            tipeKunjungan: 'igd',
            status: 'menunggu'
        }).returning();

        const newTriase = await db.insert(igdTriase).values({
            id: `TRS-${Date.now()}`,
            visitId: newVisit[0].id,
            triase: req.body.triase,
            keluhanUtama: req.body.diagnosaAwal
        }).returning();

        res.status(201).json({ success: true, visitId: newVisit[0].id });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create IGD admission', details: error.message });
    }
});

// PUT update status tindakan
router.put('/tindakan/:visitId', requireAuth, async (req, res) => {
    try {
        await db.update(visits)
            .set({ status: req.body.status })
            .where(eq(visits.id, req.params.visitId));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update IGD status', details: error.message });
    }
});

export const igdRouter = router;
