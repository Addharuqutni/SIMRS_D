/**
 * Penunjang routes — one factory serves both units (`/api/v1/laboratory` and
 * `/api/v1/radiology`); every handler is thin and delegates to the domain
 * module, and every body is Zod-parsed (no spreading of req.body anywhere).
 *
 * Capabilities (matching how the units actually work in the hospital):
 *  - reading orders: 'clinical' (doctors/nurses watch their patients' results)
 *    plus 'lab' (the unit's own worklist);
 *  - placing an order: 'clinical' (the doctor ordering) and 'lab' (the unit
 *    accepting a walk-in / verbal order);
 *  - starting and cancelling: 'lab' — the performing unit owns the worklist;
 *  - completing: 'lab', and also 'clinical' for radiologi, where the reading
 *    radiologist signs the expertise;
 *  - uploading a hasil PDF: 'lab'.
 */
import { Router, type Request } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { z } from 'zod';
import { db } from '../../db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { readPageParams } from '../../utils/pagination';
import { DomainError } from '../../utils/domain-error';
import type { Capability } from '../../../../shared/access';
import {
    attachResult, cancelOrder, completeOrder, createOrder, getOrder, listOrders, startOrder, type OrderKind,
} from './orders';

// Hasil PDF destination (server/uploads) — valid for both src/ and dist/ runs
export const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads');

// `.strict()` matters: it rejects unknown keys instead of silently dropping
// them, so a caller can never push a column the domain did not sanction.
const orderBody = z.object({
    visitId: z.string().trim().min(1).max(64),
    dokterId: z.string().trim().min(1).max(64),
    jenisPemeriksaan: z.string().trim().min(1).max(300),
    catatan: z.string().trim().max(500).optional().nullable(),
}).strict();

const idParam = z.object({ params: z.object({ id: z.string().trim().min(1).max(64) }) });

const completeBody = z.object({
    params: idParam.shape.params,
    body: z.object({
        hasilTeks: z.string().trim().max(5000).optional().nullable(),
        expertise: z.string().trim().max(5000).optional().nullable(),
        catatan: z.string().trim().max(500).optional().nullable(),
    }).strict(),
});

/** PDF-only hasil upload (max 5MB); the filename is collision-safe. */
const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (req, _file, cb) => cb(null, `${req.params.id}-${randomUUID()}.pdf`),
    }),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') return cb(new Error('Hanya file PDF yang diizinkan'));
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

const multerSingle = (req: Request) => (req as Request & { file?: Express.Multer.File }).file;

export function createPenunjangRouter(kind: OrderKind) {
    const router = Router();
    const readRoles: Capability[] = ['clinical', 'lab'];
    const createRoles: Capability[] = ['clinical', 'lab'];
    const performRoles: Capability[] = ['lab'];
    // Radiologi expertise is signed by the reading doctor as well as the unit.
    const completeRoles: Capability[] = kind === 'radiologi' ? ['lab', 'clinical'] : ['lab'];

    // GET orders — paginated, search pasien / RM / jenis, per-status counts.
    router.get('/', requireAuth, requireRole(...readRoles), asyncHandler(async (req, res) => {
        res.json(await listOrders(db, kind, readPageParams(req)));
    }));

    // GET one order
    router.get('/:id', requireAuth, requireRole(...readRoles), validate(idParam), asyncHandler(async (req, res) => {
        res.json(await getOrder(db, kind, req.params.id));
    }));

    // POST new order (charges the Kunjungan's bill at the configured tariff)
    router.post('/', requireAuth, requireRole(...createRoles), validate(z.object({ body: orderBody })), asyncHandler(async (req, res) => {
        res.status(201).json(await createOrder(db, kind, req.body));
    }));

    // PUT start processing
    router.put('/:id/start', requireAuth, requireRole(...performRoles), validate(idParam), asyncHandler(async (req, res) => {
        res.json(await startOrder(db, kind, req.params.id));
    }));

    // PUT complete with the result / expertise
    router.put('/:id/complete', requireAuth, requireRole(...completeRoles), validate(completeBody), asyncHandler(async (req, res) => {
        res.json(await completeOrder(db, kind, req.params.id, req.body));
    }));

    // PUT cancel — releases the charge
    router.put('/:id/cancel', requireAuth, requireRole(...performRoles), validate(idParam), asyncHandler(async (req, res) => {
        res.json(await cancelOrder(db, kind, req.params.id));
    }));

    // POST hasil PDF — replaces (and deletes) any previous file for this order
    router.post('/:id/hasil', requireAuth, requireRole(...performRoles), (req, res, next) => {
        upload.single('file')(req, res, (err: unknown) => {
            if (err) {
                // Rejected file (wrong mimetype / too large) is a client error
                return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload ditolak' });
            }
            next();
        });
    }, validate(idParam), asyncHandler(async (req, res) => {
        const file = multerSingle(req);
        if (!file) throw new DomainError('File PDF wajib diunggah', 400);

        const { order, replaced } = await attachResult(db, kind, req.params.id, file.filename);

        // The old PDF is unreachable once the row points at the new one.
        if (replaced && replaced !== `/uploads/${file.filename}`) {
            await rm(path.join(uploadsDir, path.basename(replaced)), { force: true }).catch(() => undefined);
        }

        res.json({ ...order, hasilUrl: `/uploads/${file.filename}` });
    }));

    return router;
}
