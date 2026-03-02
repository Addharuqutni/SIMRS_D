import { Router } from 'express';
import { db } from '../../db';
import { labOrders } from '../../db/schemas/clinical';
import { users } from '../../db/schemas/auth';
import { visits, patients } from '../../db/schemas/patient';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// GET all lab orders
router.get('/', requireAuth, async (req, res) => {
    try {
        const data = await db.select({
            id: labOrders.id,
            visitId: labOrders.visitId,
            dokterId: labOrders.dokterId,
            dokterName: users.name,
            patientName: patients.nama,
            rm: patients.rm,
            jenisPemeriksaan: labOrders.jenisPemeriksaan,
            catatan: labOrders.catatan,
            status: labOrders.status,
            hasilUrl: labOrders.hasilUrl,
            hasilTeks: labOrders.hasilTeks,
            waktuOrder: labOrders.waktuOrder,
            waktuSelesai: labOrders.waktuSelesai
        })
            .from(labOrders)
            .leftJoin(users, eq(labOrders.dokterId, users.id))
            .leftJoin(visits, eq(labOrders.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id));

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch lab orders', details: error.message });
    }
});

// POST new lab order
router.post('/', requireAuth, async (req, res) => {
    try {
        const newOrder = await db.insert(labOrders).values({
            ...req.body,
            id: `LAB-${Date.now().toString().slice(-6)}`
        }).returning();

        res.status(201).json(newOrder[0]);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create lab order', details: error.message });
    }
});

// PUT update lab order (hasil/status)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.status === 'selesai' && !updateData.waktuSelesai) {
            updateData.waktuSelesai = new Date();
        }

        const idParam = req.params.id as string;
        await db.update(labOrders).set(updateData).where(eq(labOrders.id, idParam));

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update lab order', details: error.message });
    }
});

// DELETE lab order (cancel)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const idParam = req.params.id as string;
        await db.delete(labOrders).where(eq(labOrders.id, idParam));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete lab order', details: error.message });
    }
});

export const laboratoryRouter = router;
