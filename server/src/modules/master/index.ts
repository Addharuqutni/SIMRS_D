import { Router } from 'express';
import { db } from '../../db';
import { users } from '../../db/schemas/auth';
import { auditLogs } from '../../db/schemas/audit';
import { auth } from '../../db/auth';
import { requireAuth } from '../../middleware/auth';
import { desc, eq, ilike, like, lt, or } from 'drizzle-orm';
import { requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { ROLE_GROUPS } from '../../utils/roles';
import { APIError } from 'better-auth/api';
import { resetPasswordSchema } from './schema';
import type { Response } from 'express';

const router = Router();

// Local CSV helper (same pattern as modules/reports — intentionally not shared across modules)
const sendCsv = (res: Response, filename: string, header: string[], rows: string[][]) => {
    const csvContent = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
};

const csvEscape = (value: string | number | null | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;

// GET all users
router.get('/users', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    const data = await db.select().from(users);
    res.json(data);
}));

// POST new user
router.post('/users', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    const { nama, email, role, unit, status } = req.body;
    const newUserId = `USR-${Date.now()}`;

    await db.insert(users).values({
        id: newUserId,
        name: nama,
        email,
        role,
        unit,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true
    });

    res.status(201).json({ success: true, id: newUserId });
}));

// PUT update user
router.put('/users/:id', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    const { nama, email, role, unit, status } = req.body;
    await db.update(users)
        .set({ name: nama, email, role, unit, status, updatedAt: new Date() })
        .where(eq(users.id, req.params.id));
    res.json({ success: true });
}));

// DELETE user
router.delete('/users/:id', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ success: true });
}));

// GET active doctors
router.get('/doctors', requireAuth, asyncHandler(async (req, res) => {
    const data = await db.select().from(users).where(like(users.role, 'Dokter%'));
    res.json(data);
}));

// GET audit logs (admin only)
router.get('/audit', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100, 500);

    const where = q
        ? or(ilike(auditLogs.path, `%${q}%`), ilike(auditLogs.userName, `%${q}%`))
        : undefined;

    const data = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit);
    res.json(data);
}));

// GET audit logs as CSV download (admin only)
router.get('/audit/export', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    const data = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));

    sendCsv(
        res,
        `audit_export_${new Date().toISOString().split('T')[0]}.csv`,
        ['waktu', 'user', 'ip', 'method', 'path', 'body'],
        data.map((row) => [
            csvEscape(new Date(row.createdAt).toISOString()),
            csvEscape(row.userName),
            csvEscape(row.ip),
            csvEscape(row.method),
            csvEscape(row.path),
            csvEscape(row.body),
        ])
    );
}));

// DELETE audit logs older than ?days= (admin only, default 90, minimum 30)
router.delete('/audit/purge', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    const parsedDays = Number.parseInt(String(req.query.days ?? ''), 10);
    const days = Number.isFinite(parsedDays) ? Math.max(parsedDays, 30) : 90;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const deleted = await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff)).returning({ id: auditLogs.id });

    res.json({ success: true, deleted: deleted.length, cutoff: cutoff.toISOString() });
}));

// PUT reset a user's password (admin only) — delegates to better-auth admin plugin
router.put('/users/:id/password', requireAuth, requireRole(...ROLE_GROUPS.admin), validate(resetPasswordSchema), asyncHandler(async (req, res) => {
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
