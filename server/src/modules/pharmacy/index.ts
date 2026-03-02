import { Router } from 'express';
import { db } from '../../db';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { visits, patients } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { medicines, stockMutations } from '../../db/schemas/inventory';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';
import { nanoid } from 'nanoid';

const router = Router();

// GET all prescriptions with patient and doctor details
router.get('/prescriptions', requireAuth, async (req, res) => {
    try {
        const query = await db.select({
            id: prescriptions.id,
            noResep: prescriptions.noResep,
            visitId: prescriptions.visitId,
            dokterId: prescriptions.dokterId,
            status: prescriptions.status,
            waktuResep: prescriptions.waktuResep,
            waktuSelesai: prescriptions.waktuSelesai,
            patientName: patients.nama,
            rm: patients.rm,
            dokterName: users.name,
        })
            .from(prescriptions)
            .leftJoin(visits, eq(prescriptions.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(prescriptions.dokterId, users.id))
            .orderBy(desc(prescriptions.waktuResep));

        res.json(query);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        res.status(500).json({ error: 'Failed to fetch prescriptions' });
    }
});

// GET specific prescription with items
router.get('/prescriptions/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const presc = await db.select({
            id: prescriptions.id,
            noResep: prescriptions.noResep,
            visitId: prescriptions.visitId,
            dokterId: prescriptions.dokterId,
            status: prescriptions.status,
            waktuResep: prescriptions.waktuResep,
            patientName: patients.nama,
            rm: patients.rm,
            dokterName: users.name,
        })
            .from(prescriptions)
            .leftJoin(visits, eq(prescriptions.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(prescriptions.dokterId, users.id))
            .where(eq(prescriptions.id, id))
            .limit(1);

        if (!presc.length) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        const items = await db.select({
            id: prescriptionItems.id,
            obatId: prescriptionItems.obatId,
            dosis: prescriptionItems.dosis,
            jumlah: prescriptionItems.jumlah,
            keterangan: prescriptionItems.keterangan,
            namaObat: medicines.nama,
            stok: medicines.stok,
        })
            .from(prescriptionItems)
            .leftJoin(medicines, eq(prescriptionItems.obatId, medicines.id))
            .where(eq(prescriptionItems.prescriptionId, id));

        res.json({
            ...presc[0],
            items
        });
    } catch (error) {
        console.error('Error fetching prescription details:', error);
        res.status(500).json({ error: 'Failed to fetch prescription details' });
    }
});

// POST new prescription
router.post('/prescriptions', requireAuth, async (req, res) => {
    try {
        const { visitId, dokterId, items } = req.body;

        const noResep = `RSP-${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000)}`;
        const prescId = nanoid();

        const newPresc = await db.insert(prescriptions).values({
            id: prescId,
            noResep,
            visitId,
            dokterId,
            status: 'baru'
        }).returning();

        if (items && items.length > 0) {
            const itemsToInsert = items.map((item: any) => ({
                id: nanoid(),
                prescriptionId: prescId,
                obatId: item.obatId,
                dosis: item.dosis,
                jumlah: item.jumlah,
                keterangan: item.keterangan
            }));
            await db.insert(prescriptionItems).values(itemsToInsert);
        }

        res.status(201).json(newPresc[0]);
    } catch (error) {
        console.error('Error creating prescription:', error);
        res.status(500).json({ error: 'Failed to create prescription' });
    }
});

// PUT update prescription status
router.put('/prescriptions/:id/status', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updated = await db.update(prescriptions)
            .set({
                status,
                waktuSelesai: status === 'selesai' ? new Date() : null
            })
            .where(eq(prescriptions.id, id))
            .returning();

        // If status becomes "selesai", we must decrement the medicine stock
        if (status === 'selesai') {
            const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, id));
            for (const item of items) {
                const med = await db.select().from(medicines).where(eq(medicines.id, parseInt(item.obatId))).limit(1);
                if (med.length) {
                    const newStock = Math.max(0, med[0].stok - item.jumlah);

                    // Update main stock
                    await db.update(medicines)
                        .set({ stok: newStock })
                        .where(eq(medicines.id, parseInt(item.obatId)));

                    // Record mutation
                    await db.insert(stockMutations).values({
                        medicineId: parseInt(item.obatId),
                        jenis: 'KELUAR',
                        qty: item.jumlah,
                        keterangan: `Dispensing Resep ${(req as any).user?.name || 'system'}`,
                        referensi: updated[0].noResep
                    });
                }
            }
        }

        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating prescription status:', error);
        res.status(500).json({ error: 'Failed to update prescription status' });
    }
});

export const pharmacyRouter = router;
