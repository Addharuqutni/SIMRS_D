import { Router } from 'express';
import { db } from '../../db';
import { radiologyOrders } from '../../db/schemas/clinical';
import { users } from '../../db/schemas/auth';
import { visits, patients } from '../../db/schemas/patient';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// GET all radiology orders
router.get('/', requireAuth, async (req, res) => {
    try {
        const data = await db.select({
            id: radiologyOrders.id,
            visitId: radiologyOrders.visitId,
            dokterId: radiologyOrders.dokterId,
            dokterName: users.name,
            patientName: patients.nama,
            rm: patients.rm,
            jenisPemeriksaan: radiologyOrders.jenisPemeriksaan,
            catatan: radiologyOrders.catatan,
            status: radiologyOrders.status,
            hasilDicomUrl: radiologyOrders.hasilDicomUrl,
            expertise: radiologyOrders.expertise,
            waktuOrder: radiologyOrders.waktuOrder,
            waktuSelesai: radiologyOrders.waktuSelesai
        })
            .from(radiologyOrders)
            .leftJoin(users, eq(radiologyOrders.dokterId, users.id))
            .leftJoin(visits, eq(radiologyOrders.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id));

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch radiology orders', details: error.message });
    }
});

// POST new radiology order
router.post('/', requireAuth, async (req, res) => {
    try {
        const newOrder = await db.insert(radiologyOrders).values({
            ...req.body,
            id: `RAD-${Date.now().toString().slice(-6)}`
        }).returning();

        res.status(201).json(newOrder[0]);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create radiology order', details: error.message });
    }
});

// PUT update radiology order (hasil/status)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.status === 'selesai' && !updateData.waktuSelesai) {
            updateData.waktuSelesai = new Date();
        }

        const idParam = req.params.id as string;
        await db.update(radiologyOrders).set(updateData).where(eq(radiologyOrders.id, idParam));

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update radiology order', details: error.message });
    }
});

// DELETE radiology order (cancel)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const idParam = req.params.id as string;
        await db.delete(radiologyOrders).where(eq(radiologyOrders.id, idParam));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete radiology order', details: error.message });
    }
});

export const radiologyRouter = router;
