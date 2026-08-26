import { Router } from 'express';
import { db } from '../../db';
import { auditLogs } from '../../db/schemas/audit';
import { desc, sql, and, eq, ilike, gte, lte } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/v1/audit-logs — paginated audit trail viewer for Superadmin.
 * Supports filtering by user, method, path, and date range.
 */
const listSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        userId: z.string().optional(),
        method: z.string().optional(),
        path: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
    }),
});

router.get('/', requireAuth, requireRole('Superadmin'), validate(listSchema), asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (req.query.userId) conditions.push(eq(auditLogs.userId, String(req.query.userId)));
    if (req.query.method) conditions.push(eq(auditLogs.method, String(req.query.method).toUpperCase()));
    if (req.query.path) conditions.push(ilike(auditLogs.path, `%${String(req.query.path)}%`));
    if (req.query.startDate) {
        const d = new Date(String(req.query.startDate));
        if (!isNaN(d.getTime())) conditions.push(gte(auditLogs.createdAt, d));
    }
    if (req.query.endDate) {
        const d = new Date(String(req.query.endDate));
        if (!isNaN(d.getTime())) conditions.push(lte(auditLogs.createdAt, d));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
        where
            ? db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset)
            : db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where || sql`true`),
    ]);

    const total = countResult[0]?.count ?? 0;

    res.json({
        data: rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}));

export const auditRouter = router;
