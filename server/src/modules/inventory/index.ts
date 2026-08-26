import { Router } from 'express';
import { db } from '../../db';
import { medicines, stockBatches, stockMutations, inventoryLocations, stockByLocation, stockTransfers } from '../../db/schemas/inventory';
import { users } from '../../db/schemas/auth';
import { notifications } from '../../db/schemas/notify';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { ROLE_GROUPS } from '../../utils/roles';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { createMedicineSchema, updateMedicineSchema, deleteMedicineSchema, createReceptionSchema, createOpnameSchema } from './schema';

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

// GET all medicines, enriched with the earliest unexpired batch (ed + supplier)
router.get('/', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), asyncHandler(async (req, res) => {
    const meds = await db.select().from(medicines);

    // DISTINCT ON picks, per medicine, the batch row with the smallest expired_date
    // among batches that have not expired yet.
    const earliest = await db.execute<{ medicine_id: number; expired_date: string; supplier: string | null }>(sql`
        SELECT DISTINCT ON (medicine_id) medicine_id, expired_date, supplier
        FROM stock_batches
        WHERE expired_date >= CURRENT_DATE
        ORDER BY medicine_id, expired_date ASC
    `);
    const edMap = new Map(earliest.rows.map((b) => [b.medicine_id, b]));

    res.json(meds.map((m) => ({
        ...m,
        ed: edMap.get(m.id)?.expired_date ?? null,
        supplier: edMap.get(m.id)?.supplier ?? null,
    })));
}));
// POST new medicine
router.post('/', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(createMedicineSchema), asyncHandler(async (req, res) => {
    const newItem = await db.insert(medicines).values(req.body).returning();
    res.status(201).json(newItem[0]);
}));

// POST goods reception (Penerimaan Barang): new batch + MASUK mutation + stock increment
router.post('/reception', requireAuth, requireRole(...ROLE_GROUPS.admin, ...ROLE_GROUPS.pharmacy), validate(createReceptionSchema), asyncHandler(async (req, res) => {
    const { kodeObat, noBatch, noFaktur, supplier, qty, expiredDate, hargaBeli } = req.body;

    const found = await db.select().from(medicines).where(eq(medicines.kodeObat, kodeObat)).limit(1);
    if (!found.length) {
        return res.status(404).json({ error: `Obat dengan kode ${kodeObat} tidak ditemukan` });
    }
    const medicine = found[0];

    const batch = await db.transaction(async (tx) => {
        const newBatch = await tx.insert(stockBatches).values({
            medicineId: medicine.id,
            noBatch,
            expiredDate,
            qtyMasuk: qty,
            qtySisa: qty,
            supplier,
        }).returning();

        await tx.insert(stockMutations).values({
            medicineId: medicine.id,
            batchId: newBatch[0].id,
            jenis: 'MASUK',
            qty,
            keterangan: `Penerimaan barang dari ${supplier}`,
            referensi: noFaktur,
        });

        await tx.update(medicines).set({
            stok: sql`${medicines.stok} + ${qty}`,
            ...(hargaBeli !== undefined ? { hargaBeli } : {}),
        }).where(eq(medicines.id, medicine.id));

        return newBatch[0];
    });

    res.status(201).json({ ...batch, stok: medicine.stok + qty });
}));

// POST stok opname (penyesuaian): align system stock with the physical count
router.post('/opname', requireAuth, requireRole(...ROLE_GROUPS.admin, ...ROLE_GROUPS.pharmacy), validate(createOpnameSchema), asyncHandler(async (req, res) => {
    const { items } = req.body;
    const userName = req.user?.name || 'system';

    const processed: { kodeObat: string; nama: string; stokSistem: number; stokFisik: number; selisih: number }[] = [];
    const notFound: string[] = [];
    const affected: { nama: string; stok: number; minStok: number }[] = [];

    for (const item of items) {
        const result = await db.transaction(async (tx) => {
            const found = await tx.select().from(medicines).where(eq(medicines.kodeObat, item.kodeObat)).limit(1);
            if (!found.length) return null;
            const medicine = found[0];

            const selisih = item.stokFisik - medicine.stok;
            if (selisih !== 0) {
                const arah = selisih > 0 ? 'penambahan' : 'pengurangan';
                await tx.insert(stockMutations).values({
                    medicineId: medicine.id,
                    jenis: 'PENYESUAIAN',
                    qty: Math.abs(selisih),
                    keterangan: `Stok Opname oleh ${userName}: ${arah} ${Math.abs(selisih)} (sistem ${medicine.stok} → fisik ${item.stokFisik})${item.catatan ? ` — ${item.catatan}` : ''}`,
                    referensi: 'STOK OPNAME',
                });

                await tx.update(medicines).set({ stok: item.stokFisik }).where(eq(medicines.id, medicine.id));
            }

            return { medicine, selisih };
        });

        if (!result) {
            notFound.push(item.kodeObat);
            continue;
        }
        processed.push({
            kodeObat: item.kodeObat,
            nama: result.medicine.nama,
            stokSistem: result.medicine.stok,
            stokFisik: item.stokFisik,
            selisih: result.selisih,
        });
        affected.push({ nama: result.medicine.nama, stok: item.stokFisik, minStok: result.medicine.minStok });
    }

    // Fire-and-forget: never fails the opname
    void notifyLowStock(affected);

    res.status(201).json({ processed, notFound });
}));

// PUT update medicine
router.put('/:kode', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(updateMedicineSchema), asyncHandler(async (req, res) => {
    const kodeParam = req.params.kode as string;
    await db.update(medicines).set({ ...req.body, updatedAt: new Date() }).where(eq(medicines.kodeObat, kodeParam));
    res.json({ success: true });
}));

// DELETE medicine
router.delete('/:kode', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(deleteMedicineSchema), asyncHandler(async (req, res) => {
    const kodeParam = req.params.kode as string;
    // Optional: you can choose to soft-delete by changing status if there are FK constraints
    await db.delete(medicines).where(eq(medicines.kodeObat, kodeParam));
    res.json({ success: true, message: 'Item deleted' });
}));

// ==========================================
// MULTI-WAREHOUSE: LOCATIONS & STOCK TRANSFER
// ==========================================

// GET all inventory locations
router.get('/locations', requireAuth, asyncHandler(async (_req, res) => {
    const data = await db.select().from(inventoryLocations).orderBy(inventoryLocations.nama);
    res.json(data);
}));

// POST create a new location
const createLocationSchema = z.object({
    body: z.object({
        kode: z.string().min(1).max(20),
        nama: z.string().min(1).max(100),
        tipe: z.enum(['farmasi', 'depot', 'ok', 'igd']).optional(),
    }),
});
router.post('/locations', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(createLocationSchema), asyncHandler(async (req, res) => {
    const created = await db.insert(inventoryLocations).values(req.body).returning();
    res.status(201).json(created[0]);
}));

// GET stock by location for a given medicine (or all medicines at a location)
router.get('/stock-by-location', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), asyncHandler(async (req, res) => {
    const medicineId = req.query.medicineId ? Number(req.query.medicineId) : undefined;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;

    let query = db.select({
        id: stockByLocation.id,
        medicineId: stockByLocation.medicineId,
        medicineName: medicines.nama,
        medicineKode: medicines.kodeObat,
        satuan: medicines.satuan,
        locationId: stockByLocation.locationId,
        locationName: inventoryLocations.nama,
        locationKode: inventoryLocations.kode,
        stok: stockByLocation.stok,
        updatedAt: stockByLocation.updatedAt,
    }).from(stockByLocation)
        .leftJoin(medicines, eq(stockByLocation.medicineId, medicines.id))
        .leftJoin(inventoryLocations, eq(stockByLocation.locationId, inventoryLocations.id));

    const conditions = [];
    if (medicineId) conditions.push(eq(stockByLocation.medicineId, medicineId));
    if (locationId) conditions.push(eq(stockByLocation.locationId, locationId));

    if (conditions.length === 1) {
        query = query.where(conditions[0]) as typeof query;
    } else if (conditions.length === 2) {
        query = query.where(and(...conditions)) as typeof query;
    }

    const data = await query.orderBy(stockByLocation.locationId, stockByLocation.medicineId);
    res.json(data);
}));

// POST transfer stock between two locations (atomic, with mutation log)
const transferSchema = z.object({
    body: z.object({
        medicineId: z.number().int().positive(),
        fromLocationId: z.number().int().positive(),
        toLocationId: z.number().int().positive(),
        qty: z.number().int().positive('Qty transfer harus > 0'),
        catatan: z.string().max(500).optional(),
    }),
});
router.post('/transfer', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(transferSchema), asyncHandler(async (req, res) => {
    const { medicineId, fromLocationId, toLocationId, qty, catatan } = req.body;

    if (fromLocationId === toLocationId) {
        return res.status(400).json({ error: 'Lokasi asal dan tujuan tidak boleh sama' });
    }

    const result = await db.transaction(async (tx) => {
        // 1. Verify source has enough stock
        const src = await db.select().from(stockByLocation)
            .where(and(eq(stockByLocation.medicineId, medicineId), eq(stockByLocation.locationId, fromLocationId)))
            .limit(1);
        if (!src.length || src[0].stok < qty) {
            throw new Error('Stok di lokasi asal tidak mencukupi');
        }

        // 2. Decrement source
        await tx.update(stockByLocation)
            .set({ stok: src[0].stok - qty, updatedAt: new Date() })
            .where(eq(stockByLocation.id, src[0].id));

        // 3. Upsert destination (create row if not exists)
        const dst = await db.select().from(stockByLocation)
            .where(and(eq(stockByLocation.medicineId, medicineId), eq(stockByLocation.locationId, toLocationId)))
            .limit(1);
        if (dst.length) {
            await tx.update(stockByLocation)
                .set({ stok: dst[0].stok + qty, updatedAt: new Date() })
                .where(eq(stockByLocation.id, dst[0].id));
        } else {
            await tx.insert(stockByLocation).values({
                medicineId,
                locationId: toLocationId,
                stok: qty,
            });
        }

        // 4. Log the transfer (two mutation rows for audit clarity)
        await tx.insert(stockMutations).values({
            medicineId,
            jenis: 'TRANSFER',
            qty,
            keterangan: `Transfer ke lokasi ${toLocationId}${catatan ? ': ' + catatan : ''}`,
            referensi: `TRF-${Date.now()}`,
            locationId: fromLocationId,
        });

        // 5. Create the transfer record
        const transfer = await tx.insert(stockTransfers).values({
            medicineId,
            fromLocationId,
            toLocationId,
            qty,
            status: 'selesai',
            requestedBy: req.user?.name || '-',
            catatan,
        }).returning();

        return transfer[0];
    }).catch((err: unknown) => {
        throw new Error(err instanceof Error ? err.message : 'Gagal transfer stok');
    });

    res.status(201).json({ success: true, data: result });
}));

export const inventoryRouter = router;
