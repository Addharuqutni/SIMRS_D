import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { createOrder, type OrderKind } from '../penunjang/orders';

const router = Router();

/** EMR path segment → penunjang kind. */
const KIND: Record<'lab' | 'radiology', OrderKind> = { lab: 'lab', radiology: 'radiologi' };

const createOrderSchema = z.object({
    params: z.object({ type: z.enum(['lab', 'radiology']) }),
    body: z.object({
        visitId: z.string().trim().min(1).max(64),
        dokterId: z.string().trim().min(1).max(64),
        jenisPemeriksaan: z.string().trim().min(1).max(300),
        catatan: z.string().trim().max(500).optional().nullable(),
    }).strict(),
});

// POST Orders (Lab / Radiology) from the EMR — same domain call as the unit routes.
router.post('/orders/:type', requireAuth, requireRole('clinical'), validate(createOrderSchema), asyncHandler(async (req, res) => {
    res.status(201).json(await createOrder(db, KIND[req.params.type as 'lab' | 'radiology'], req.body));
}));

export const clinicalOrdersRouter = router;
