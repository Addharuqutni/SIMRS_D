import { Router } from 'express';
import { db } from '../../db';
import { medicines, stockBatches, stockMutations, inventoryLocations, stockByLocation, stockTransfers } from '../../db/schemas/inventory';
import { eq, sql, and, desc, ilike, or, lt, gt } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { z } from 'zod';
import { NEAR_EXPIRY_DAYS } from '../../../../shared/inventory';
import { readPageParams, toPage } from '../../utils/pagination';
import { DomainError, notFound } from '../../utils/domain-error';
import { adjustToCount, notifyLowStock, receiveBatch, removeBatch, type StockLevel } from './stock';
import { createMedicineSchema, updateMedicineSchema, deleteMedicineSchema, createReceptionSchema, createOpnameSchema, disposeBatchSchema } from './schema';

const router = Router();

async function medicineByKode(kode: string) {
    const [med] = await db.select().from(medicines).where(eq(medicines.kodeObat, kode)).limit(1);
    if (!med) throw notFound(`Obat dengan kode ${kode}`);
    return med;
}

// GET medicines — paginated; each row carries its earliest unexpired batch (ed + supplier)
router.get('/', requireAuth, requireRole('pharmacy'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const where = p.q ? or(ilike(medicines.nama, `%${p.q}%`), ilike(medicines.kodeObat, `%${p.q}%`)) : undefined;
    const [meds, [{ total }]] = await Promise.all([
        db.select().from(medicines).where(where).orderBy(medicines.nama).limit(p.limit).offset(p.offset),
        db.select({ total: sql<number>`count(*)::int` }).from(medicines).where(where),
    ]);

    // DISTINCT ON picks, per medicine, the unexpired batch with the smallest expired_date.
    const earliest = meds.length ? await db.execute<{ medicine_id: number; expired_date: string; supplier: string | null }>(sql`
        SELECT DISTINCT ON (medicine_id) medicine_id, expired_date, supplier
        FROM stock_batches
        WHERE expired_date >= CURRENT_DATE AND qty_sisa > 0
          AND medicine_id IN (${sql.join(meds.map((m) => sql`${m.id}`), sql`, `)})
        ORDER BY medicine_id, expired_date ASC
    `) : { rows: [] };
    const edMap = new Map(earliest.rows.map((b) => [b.medicine_id, b]));

    res.json(toPage(meds.map((m) => ({
        ...m,
        ed: edMap.get(m.id)?.expired_date ?? null,
        supplier: edMap.get(m.id)?.supplier ?? null,
    })), Number(total), p));
}));

// GET batches that are expired or expire within NEAR_EXPIRY_DAYS, still holding stock
router.get('/batches/expiring', requireAuth, requireRole('pharmacy'), asyncHandler(async (_req, res) => {
    const rows = await db.select({
        id: stockBatches.id,
        noBatch: stockBatches.noBatch,
        expiredDate: stockBatches.expiredDate,
        qtySisa: stockBatches.qtySisa,
        supplier: stockBatches.supplier,
        kodeObat: medicines.kodeObat,
        nama: medicines.nama,
        kategori: medicines.kategori,
        satuan: medicines.satuan,
        expired: sql<boolean>`${stockBatches.expiredDate} < CURRENT_DATE`,
    })
        .from(stockBatches)
        .innerJoin(medicines, eq(stockBatches.medicineId, medicines.id))
        .where(and(gt(stockBatches.qtySisa, 0), lt(stockBatches.expiredDate, sql`CURRENT_DATE + ${NEAR_EXPIRY_DAYS}::int`)))
        .orderBy(stockBatches.expiredDate);
    res.json(rows);
}));

// POST take a batch out of stock: dimusnahkan (expired) or diretur ke supplier
router.post('/batches/:id/dispose', requireAuth, requireRole('pharmacy'), validate(disposeBatchSchema), asyncHandler(async (req, res) => {
    const { jenis, catatan } = req.body as z.infer<typeof disposeBatchSchema>['body'];
    const level = await db.transaction((tx) => removeBatch(tx, Number(req.params.id), jenis,
        `${jenis === 'MUSNAH' ? 'Pemusnahan' : 'Retur'} oleh ${req.user?.name ?? 'system'}${catatan ? ` — ${catatan}` : ''}`));
    await notifyLowStock(db, [level]);
    res.json({ success: true, stok: level.stok });
}));

// GET kartu stok: all movements for one medicine, newest first
router.get('/:kode/mutations', requireAuth, requireRole('pharmacy'), asyncHandler(async (req, res) => {
    const med = await medicineByKode(req.params.kode);
    const rows = await db.select({
        id: stockMutations.id,
        jenis: stockMutations.jenis,
        qty: stockMutations.qty,
        keterangan: stockMutations.keterangan,
        referensi: stockMutations.referensi,
        createdAt: stockMutations.createdAt,
        noBatch: stockBatches.noBatch,
    })
        .from(stockMutations)
        .leftJoin(stockBatches, eq(stockMutations.batchId, stockBatches.id))
        .where(eq(stockMutations.medicineId, med.id))
        .orderBy(desc(stockMutations.createdAt), desc(stockMutations.id))
        .limit(200);
    res.json(rows);
}));

// POST new medicine — stock starts at 0 and only grows through reception
router.post('/', requireAuth, requireRole('pharmacy'), validate(createMedicineSchema), asyncHandler(async (req, res) => {
    const [dup] = await db.select({ id: medicines.id }).from(medicines).where(eq(medicines.kodeObat, req.body.kodeObat)).limit(1);
    if (dup) throw new DomainError(`Kode obat ${req.body.kodeObat} sudah terdaftar`, 409);

    const [created] = await db.insert(medicines).values(req.body).returning();
    res.status(201).json(created);
}));

// POST goods reception (Penerimaan Barang): new batch + MASUK mutation + stock increment
router.post('/reception', requireAuth, requireRole('admin', 'pharmacy'), validate(createReceptionSchema), asyncHandler(async (req, res) => {
    const med = await medicineByKode(req.body.kodeObat);
    const batch = await db.transaction((tx) => receiveBatch(tx, { ...req.body, medicineId: med.id }));
    res.status(201).json(batch);
}));

// POST stok opname (penyesuaian): align system stock with the physical count
router.post('/opname', requireAuth, requireRole('admin', 'pharmacy'), validate(createOpnameSchema), asyncHandler(async (req, res) => {
    const items = req.body.items as z.infer<typeof createOpnameSchema>['body']['items'];
    const userName = req.user?.name || 'system';

    const processed: { kodeObat: string; nama: string; stokSistem: number; stokFisik: number; selisih: number }[] = [];
    const unknown: string[] = [];
    const levels: StockLevel[] = [];

    for (const item of items) {
        const [med] = await db.select({ id: medicines.id }).from(medicines).where(eq(medicines.kodeObat, item.kodeObat)).limit(1);
        if (!med) {
            unknown.push(item.kodeObat);
            continue;
        }
        const r = await db.transaction((tx) => adjustToCount(tx, med.id, item.stokFisik,
            `Stok Opname oleh ${userName}${item.catatan ? ` — ${item.catatan}` : ''}`));
        processed.push({ kodeObat: item.kodeObat, nama: r.medicine.nama, stokSistem: r.medicine.stok, stokFisik: item.stokFisik, selisih: r.selisih });
        levels.push(r.level);
    }

    await notifyLowStock(db, levels);
    res.status(201).json({ processed, notFound: unknown });
}));

// PUT update medicine master data (stock changes go through reception/opname)
router.put('/:kode', requireAuth, requireRole('pharmacy'), validate(updateMedicineSchema), asyncHandler(async (req, res) => {
    await db.update(medicines).set(req.body).where(eq(medicines.kodeObat, req.params.kode));
    res.json({ success: true });
}));

// DELETE medicine — only when it has never moved stock
router.delete('/:kode', requireAuth, requireRole('pharmacy'), validate(deleteMedicineSchema), asyncHandler(async (req, res) => {
    const med = await medicineByKode(req.params.kode);
    const [used] = await db.select({ id: stockMutations.id }).from(stockMutations).where(eq(stockMutations.medicineId, med.id)).limit(1);
    if (used) throw new DomainError('Obat sudah memiliki riwayat mutasi stok dan tidak dapat dihapus', 409);
    await db.delete(medicines).where(eq(medicines.id, med.id));
    res.json({ success: true });
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
router.post('/locations', requireAuth, requireRole('pharmacy'), validate(createLocationSchema), asyncHandler(async (req, res) => {
    const created = await db.insert(inventoryLocations).values(req.body).returning();
    res.status(201).json(created[0]);
}));

// GET stock by location for a given medicine (or all medicines at a location)
router.get('/stock-by-location', requireAuth, requireRole('pharmacy'), asyncHandler(async (req, res) => {
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
router.post('/transfer', requireAuth, requireRole('pharmacy'), validate(transferSchema), asyncHandler(async (req, res) => {
    const { medicineId, fromLocationId, toLocationId, qty, catatan } = req.body;

    if (fromLocationId === toLocationId) throw new DomainError('Lokasi asal dan tujuan tidak boleh sama', 400);

    const result = await db.transaction(async (tx) => {
        const [src] = await tx.select().from(stockByLocation)
            .where(and(eq(stockByLocation.medicineId, medicineId), eq(stockByLocation.locationId, fromLocationId)))
            .for('update');
        if (!src || src.stok < qty) throw new DomainError('Stok di lokasi asal tidak mencukupi', 409);

        await tx.update(stockByLocation)
            .set({ stok: src.stok - qty, updatedAt: new Date() })
            .where(eq(stockByLocation.id, src.id));

        const [dst] = await tx.select().from(stockByLocation)
            .where(and(eq(stockByLocation.medicineId, medicineId), eq(stockByLocation.locationId, toLocationId)))
            .for('update');
        if (dst) {
            await tx.update(stockByLocation).set({ stok: dst.stok + qty, updatedAt: new Date() }).where(eq(stockByLocation.id, dst.id));
        } else {
            await tx.insert(stockByLocation).values({ medicineId, locationId: toLocationId, stok: qty });
        }

        const [transfer] = await tx.insert(stockTransfers).values({
            medicineId, fromLocationId, toLocationId, qty, status: 'selesai', requestedBy: req.user?.name || '-', catatan,
        }).returning();

        await tx.insert(stockMutations).values({
            medicineId,
            jenis: 'TRANSFER',
            qty,
            keterangan: `Transfer ke lokasi ${toLocationId}${catatan ? ': ' + catatan : ''}`,
            referensi: `TRF-${transfer.id}`,
            locationId: fromLocationId,
        });
        return transfer;
    });

    res.status(201).json({ success: true, data: result });
}));

export const inventoryRouter = router;
