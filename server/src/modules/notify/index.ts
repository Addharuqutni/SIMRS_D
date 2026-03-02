import { Router } from 'express';
import { db } from '../../db';
import { notifications } from '../../db/schemas/notify';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// GET pending notifications
router.get('/', requireAuth, async (req, res) => {
    try {
        const data = await db.select().from(notifications);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

export const notifyRouter = router;
