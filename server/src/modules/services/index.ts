import { Router } from 'express';
import { db } from '../../db';
import { prescriptions } from '../../db/schemas/services';
import { labOrders } from '../../db/schemas/clinical';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// GET Lab Orders
router.get('/lab', requireAuth, async (req, res) => {
    try {
        const orders = await db.select().from(labOrders);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lab orders' });
    }
});

// GET Pharmacy Prescriptions
router.get('/pharmacy', requireAuth, async (req, res) => {
    try {
        const data = await db.select().from(prescriptions);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pharmacy prescriptions' });
    }
});

export const servicesRouter = router;
