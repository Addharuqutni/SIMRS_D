import { Router } from 'express';
import { db } from '../../db';
import { notifications } from '../../db/schemas/notify';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { countsByStatus, readPageParams, toPage } from '../../utils/pagination';

const router = Router();

// GET notifications for the logged-in user — paginated; status = baca|belum_dibaca
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const userId = req.user!.id;

    // status dimension: 'baca' (read) / 'belum_dibaca' (unread); ?unread=true kept for compatibility
    const unreadOnly = p.status === 'belum_dibaca' || req.query.unread === 'true';
    const readOnly = p.status === 'baca';
    const isRead = unreadOnly ? eq(notifications.isRead, false) : readOnly ? eq(notifications.isRead, true) : undefined;

    const search = p.q
        ? or(ilike(notifications.title, `%${p.q}%`), ilike(notifications.message, `%${p.q}%`))
        : undefined;
    const scope = eq(notifications.userId, userId);

    const [rows, statusRows, totalRows] = await Promise.all([
        db.select().from(notifications)
            .where(and(scope, search, isRead))
            .orderBy(desc(notifications.createdAt), desc(notifications.id))
            .limit(p.limit).offset(p.offset),
        db.select({ status: sql<string>`case when ${notifications.isRead} then 'baca' else 'belum_dibaca' end`, n: count() })
            .from(notifications).where(and(scope, search))
            .groupBy(sql`case when ${notifications.isRead} then 'baca' else 'belum_dibaca' end`),
        db.select({ n: count() }).from(notifications).where(and(scope, search, isRead)),
    ]);

    const counts = countsByStatus(statusRows);
    res.json(toPage(rows, Number(totalRows[0]?.n ?? 0), p, counts));
}));

// GET unread count for the logged-in user
router.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const rows = await db.select({ n: count() }).from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    res.json({ count: Number(rows[0]?.n ?? 0) });
}));

// PUT mark all of the user's notifications as read
router.put('/read-all', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const updated = await db.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .returning({ id: notifications.id });
    res.json({ updated: updated.length });
}));

// PUT mark one notification as read (ownership enforced)
router.put('/:id/read', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid notification id' });
    }
    const updated = await db.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
        .returning();
    if (!updated.length) {
        return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(updated[0]);
}));

// DELETE one notification (ownership enforced)
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid notification id' });
    }
    const deleted = await db.delete(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
        .returning({ id: notifications.id });
    if (!deleted.length) {
        return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ deleted: deleted[0].id });
}));

export const notifyRouter = router;
