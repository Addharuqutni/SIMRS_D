import { Router } from 'express';
import { db } from '../../db';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { visits, patients } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { medicines, stockMutations, stockBatches } from '../../db/schemas/inventory';
import { notifications } from '../../db/schemas/notify';
import { eq, desc, and, asc, gt, inArray } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { ROLE_GROUPS } from '../../utils/roles';
import { logger } from '../../utils/logger';
import { nanoid } from 'nanoid';

const router = Router();

// Fire-and-forget low-stock notification for Apoteker/Superadmin (one row per user).
// Dedupe: skip while an unread notification with the same title (same medicine) exists.
const notifyLowStock = async (meds: { nama: string; stok: number; minStok: number }[]) => {
    try {
        const low = meds.filter((m) => m.stok < m.minStok);
        if (!low.length) return;

        const targets = await db.select({ id: users.id }).from(users)
            .where(inArray(users.role, ['Apoteker', 'Superadmin']));
        if (!targets.length) return;

        for (const med of low) {
            const title = `Stok Menipis: ${med.nama}`;
            const existing = await db.select({ id: notifications.id }).from(notifications)
                .where(and(eq(notifications.title, title), eq(notifications.isRead, false)))
                .limit(1);
            if (existing.length) continue;

            await db.insert(notifications).values(targets.map((u) => ({
                userId: u.id,
                title,
                message: `Stok ${med.nama} tersisa ${med.stok} (di bawah minimum ${med.minStok}). Segera lakukan pemesanan ulang.`,
                type: 'warning',
                linkUrl: '/farmasi/stok',
            })));
        }
    } catch (err) {
        logger.error(`Gagal mengirim notifikasi stok menipis: ${err instanceof Error ? err.message : err}`);
    }
};

// GET all prescriptions with patient and doctor details
router.get('/prescriptions', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), asyncHandler(async (req, res) => {
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
}));

// GET specific prescription with items
router.get('/prescriptions/:id', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), asyncHandler(async (req, res) => {
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
}));

// POST new prescription
router.post('/prescriptions', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), asyncHandler(async (req, res) => {
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
}));

// PUT update prescription status
router.put('/prescriptions/:id/status', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), asyncHandler(async (req, res) => {
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
        const affected: { nama: string; stok: number; minStok: number }[] = [];
        for (const item of items) {
            const med = await db.select().from(medicines).where(eq(medicines.id, parseInt(item.obatId))).limit(1);
            if (!med.length) continue;
            const medicine = med[0];

            const newStock = await db.transaction(async (tx) => {
                // FEFO: consume batch stock starting from the earliest expiry date
                // (tie-break lowest id) while the batch still has qtySisa.
                const batches = await tx.select().from(stockBatches)
                    .where(and(eq(stockBatches.medicineId, medicine.id), gt(stockBatches.qtySisa, 0)))
                    .orderBy(asc(stockBatches.expiredDate), asc(stockBatches.id));

                let remaining = item.jumlah;
                const consumed: { batchId: number | null; qty: number }[] = [];
                for (const batch of batches) {
                    if (remaining <= 0) break;
                    const take = Math.min(batch.qtySisa, remaining);
                    await tx.update(stockBatches)
                        .set({ qtySisa: batch.qtySisa - take })
                        .where(eq(stockBatches.id, batch.id));
                    consumed.push({ batchId: batch.id, qty: take });
                    remaining -= take;
                }
                // Data drift: batches cannot cover the full quantity — record the
                // uncovered remainder as a mutation without batchId instead of failing.
                if (remaining > 0) {
                    consumed.push({ batchId: null, qty: remaining });
                }

                for (const c of consumed) {
                    await tx.insert(stockMutations).values({
                        medicineId: medicine.id,
                        batchId: c.batchId,
                        jenis: 'KELUAR',
                        qty: c.qty,
                        keterangan: `Dispensing Resep ${req.user?.name || 'system'}`,
                        referensi: updated[0].noResep,
                    });
                }

                // Update main stock (total decrement, unchanged behavior)
                const newStock = Math.max(0, medicine.stok - item.jumlah);
                await tx.update(medicines)
                    .set({ stok: newStock })
                    .where(eq(medicines.id, medicine.id));

                return newStock;
            });

            affected.push({ nama: medicine.nama, stok: newStock, minStok: medicine.minStok });
        }
        // Fire-and-forget: never fails the dispensing
        void notifyLowStock(affected);
    }

    res.json(updated[0]);
}));

export const pharmacyRouter = router;
