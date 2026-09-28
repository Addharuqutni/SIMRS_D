import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { billings, billingItems, transactions } from '../../db/schemas/billing';
import { visits, patients } from '../../db/schemas/patient';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { countsByStatus, readPageParams, toPage } from '../../utils/pagination';
import { notFound } from '../../utils/domain-error';
import { finalize, pay } from './ledger';

const router = Router();

const listColumns = {
    id: billings.id,
    noBilling: billings.noBilling,
    visitId: billings.visitId,
    total: billings.total,
    status: billings.status,
    waktuFinalisasi: billings.waktuFinalisasi,
    waktuBayar: billings.waktuBayar,
    metodePembayaran: billings.metodePembayaran,
    createdAt: billings.createdAt,
    patientName: patients.nama,
    rm: patients.rm,
    jaminan: visits.jaminan,
    poli: visits.poliId,
};

// GET ledger transactions for Laporan Keuangan — static path, must precede /:id
router.get('/transactions', requireAuth, requireRole('billing'), asyncHandler(async (_req, res) => {
    res.json(await db.select().from(transactions).orderBy(desc(transactions.tanggal)));
}));

// GET billings — paginated, search by patient / RM / no billing, per-status counts
router.get('/', requireAuth, requireRole('billing'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const search: SQL | undefined = p.q
        ? or(ilike(patients.nama, `%${p.q}%`), ilike(patients.rm, `%${p.q}%`), ilike(billings.noBilling, `%${p.q}%`))
        : undefined;
    const where = and(search, p.status ? eq(billings.status, p.status) : undefined);
    const [rows, statusRows] = await Promise.all([
        db.select(listColumns).from(billings)
            .leftJoin(visits, eq(billings.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(where).orderBy(desc(billings.createdAt)).limit(p.limit).offset(p.offset),
        db.select({ status: billings.status, n: count() }).from(billings)
            .leftJoin(visits, eq(billings.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(search).groupBy(billings.status),
    ]);
    const counts = countsByStatus(statusRows);
    const total = p.status ? (counts[p.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    res.json(toPage(rows, total, p, counts));
}));

// GET billing detail with items
router.get('/:id', requireAuth, requireRole('billing'), asyncHandler(async (req, res) => {
    const [bill] = await db.select(listColumns).from(billings)
        .leftJoin(visits, eq(billings.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(billings.id, req.params.id))
        .limit(1);
    if (!bill) throw notFound('Billing');

    const items = await db.select().from(billingItems).where(eq(billingItems.billingId, bill.id)).orderBy(billingItems.createdAt);
    res.json({ ...bill, items });
}));

// POST finalize the Kunjungan's bill — totals what services already charged
router.post('/visit/:visitId/finalize', requireAuth, requireRole('billing'), asyncHandler(async (req, res) => {
    res.json(await finalize(db, req.params.visitId));
}));

const paySchema = z.object({
    body: z.object({ metodePembayaran: z.enum(['tunai', 'debit', 'transfer', 'qris', 'bpjs']) }),
});

// PUT settle a finalized bill
router.put('/:id/pay', requireAuth, requireRole('billing'), validate(paySchema), asyncHandler(async (req, res) => {
    res.json(await pay(db, req.params.id, req.body.metodePembayaran, req.user?.id));
}));

export const billingRouter = router;
