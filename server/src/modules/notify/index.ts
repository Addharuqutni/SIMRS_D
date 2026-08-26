import { Router } from 'express';
import { db } from '../../db';
import { notifications } from '../../db/schemas/notify';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { and, desc, eq } from 'drizzle-orm';

const router = Router();

// GET notifications for the logged-in user (newest first, max 100, optional ?unread=true)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conditions = [eq(notifications.userId, userId)];
    if (req.query.unread === 'true') {
        conditions.push(eq(notifications.isRead, false));
    }
    const data = await db.select().from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(100);
    res.json(data);
}));

// GET unread count for the logged-in user
router.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const rows = await db.select({ id: notifications.id }).from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    res.json({ count: rows.length });
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
