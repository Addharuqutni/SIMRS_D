import { Router } from 'express';
import { db } from '../../db';
import { auth } from '../../db/auth';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { readPageParams, toPage } from '../../utils/pagination';
import { APIError } from 'better-auth/api';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from './schema';
import { createUser, deactivateUser, listDoctors, listUsers, updateUser } from './users';

const router = Router();

// GET users — paginated, search by nama / email / role / unit, per-status counts
router.get('/users', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const { rows, total, counts } = await listUsers(db, { q: p.q, status: p.status, limit: p.limit, offset: p.offset });
    res.json(toPage(rows, total, p, counts));
}));

// POST new user — Zod-validated (role must be a known Role, email valid, status enum)
router.post('/users', requireAuth, requireRole('admin'), validate(createUserSchema), asyncHandler(async (req, res) => {
    const { id } = await createUser(db, req.body);
    res.status(201).json({ success: true, id });
}));

// PUT update user
router.put('/users/:id', requireAuth, requireRole('admin'), validate(updateUserSchema), asyncHandler(async (req, res) => {
    await updateUser(db, req.params.id, req.body);
    res.json({ success: true });
}));

// DELETE user — soft delete: deactivates the account and revokes its sessions.
// Kept as DELETE because the action removes access; the row and its history stay.
router.delete('/users/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    await deactivateUser(db, req.params.id);
    res.json({ success: true });
}));

// GET active doctors — exact DOCTOR_ROLES match, status aktif only
router.get('/doctors', requireAuth, asyncHandler(async (_req, res) => {
    res.json(await listDoctors(db));
}));

// PUT reset a user's password (admin only) — delegates to better-auth admin plugin
router.put('/users/:id/password', requireAuth, requireRole('admin'), validate(resetPasswordSchema), asyncHandler(async (req, res) => {
    const { password } = req.body as { password: string };

    try {
        await auth.api.setUserPassword({
            body: { userId: req.params.id, newPassword: password },
            headers: req.headers as unknown as HeadersInit,
        });
    } catch (err) {
        if (err instanceof APIError) {
            const body = err.body as { message?: string } | undefined;
            return res.status(typeof err.status === 'number' ? err.status : 400).json({
                error: body?.message || 'Gagal mereset password',
            });
        }
        throw err;
    }

    res.json({ success: true });
}));

export const masterRouter = router;
