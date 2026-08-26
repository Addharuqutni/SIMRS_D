import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { db } from '../db';
import { users } from '../db/schemas/auth';
import { visits, patients } from '../db/schemas/patient';
import { labOrders, radiologyOrders } from '../db/schemas/clinical';
import { eq } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

type OrdersTable = typeof labOrders | typeof radiologyOrders;

// Hasil upload destination (server/uploads) — valid for both src/ and dist/ runs
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');

// Shared factory for lab/radiology order routers: identical routes and
// middleware, differing only by table, roles, id prefix, the
// table-specific fields included in the GET projection, and the column
// that stores the uploaded hasil PDF.
export const createOrdersRouter = (
    table: OrdersTable,
    roles: string[],
    idPrefix: string,
    extraSelect: Record<string, AnyPgColumn>,
    hasilColumn: 'hasilUrl' | 'hasilDicomUrl'
) => {
    // PDF-only hasil upload (max 5MB), stored as <prefix><id>-<timestamp>.pdf
    const upload = multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, uploadsDir),
            filename: (req, _file, cb) => cb(null, `${idPrefix}${req.params.id}-${Date.now()}.pdf`)
        }),
        fileFilter: (_req, file, cb) => {
            if (file.mimetype !== 'application/pdf') {
                return cb(new Error('Hanya file PDF yang diizinkan'));
            }
            cb(null, true);
        },
        limits: { fileSize: 5 * 1024 * 1024 }
    });

    const router = Router();

    // GET all orders
    router.get('/', requireAuth, requireRole(...roles), asyncHandler(async (req, res) => {
        const data = await db.select({
            id: table.id,
            visitId: table.visitId,
            dokterId: table.dokterId,
            dokterName: users.name,
            patientName: patients.nama,
            rm: patients.rm,
            jenisPemeriksaan: table.jenisPemeriksaan,
            catatan: table.catatan,
            status: table.status,
            ...extraSelect,
            waktuOrder: table.waktuOrder,
            waktuSelesai: table.waktuSelesai
        })
            .from(table)
            .leftJoin(users, eq(table.dokterId, users.id))
            .leftJoin(visits, eq(table.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id));

        res.json(data);
    }));

    // POST new order
    router.post('/', requireAuth, requireRole(...roles), asyncHandler(async (req, res) => {
        const newOrder = await db.insert(table).values({
            ...req.body,
            id: `${idPrefix}${Date.now().toString().slice(-6)}`
        }).returning();

        res.status(201).json(newOrder[0]);
    }));

    // POST hasil upload (PDF, max 5MB)
    router.post('/:id/hasil', requireAuth, requireRole(...roles), (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) {
                // Rejected file (wrong mimetype / too large) is a client error
                return res.status(400).json({ error: err.message });
            }
            next();
        });
    }, asyncHandler(async (req, res) => {
        if (!req.file) {
            res.status(400).json({ error: 'File PDF wajib diunggah' });
            return;
        }

        const hasilUrl = `/uploads/${req.file.filename}`;
        const updated = await db.update(table)
            .set({ [hasilColumn]: hasilUrl } as any)
            .where(eq(table.id, req.params.id))
            .returning();

        if (updated.length === 0) {
            res.status(404).json({ error: 'Order tidak ditemukan' });
            return;
        }

        res.json(updated[0]);
    }));

    // PUT update order (hasil/status)
    router.put('/:id', requireAuth, requireRole(...roles), asyncHandler(async (req, res) => {
        const updateData = { ...req.body };
        if (updateData.status === 'selesai' && !updateData.waktuSelesai) {
            updateData.waktuSelesai = new Date();
        }

        await db.update(table).set(updateData).where(eq(table.id, req.params.id));

        res.json({ success: true });
    }));

    // DELETE order (cancel)
    router.delete('/:id', requireAuth, requireRole(...roles), asyncHandler(async (req, res) => {
        await db.delete(table).where(eq(table.id, req.params.id));
        res.json({ success: true });
    }));

    return router;
};
