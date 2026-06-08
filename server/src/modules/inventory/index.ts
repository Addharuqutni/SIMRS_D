import { Router } from 'express';
import { db } from '../../db';
import { medicines, stockBatches, stockMutations } from '../../db/schemas/inventory';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { ROLE_GROUPS } from '../../utils/roles';
import { validate } from '../../middleware/validate';
import { createMedicineSchema, updateMedicineSchema, deleteMedicineSchema } from './schema';

const router = Router();

// GET all medicines
router.get('/', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), async (req, res) => {
    try {
        const data = await db.select().from(medicines);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch medicines' });
    }
});
// POST new medicine
router.post('/', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(createMedicineSchema), async (req, res) => {
    try {
        const newItem = await db.insert(medicines).values(req.body).returning();
        res.status(201).json(newItem[0]);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create medicine', details: error.message });
    }
});

// PUT update medicine
router.put('/:kode', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(updateMedicineSchema), async (req, res) => {
    try {
        const kodeParam = req.params.kode as string;
        await db.update(medicines).set({ ...req.body, updatedAt: new Date() }).where(eq(medicines.kodeObat, kodeParam));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update medicine', details: error.message });
    }
});

// DELETE medicine
router.delete('/:kode', requireAuth, requireRole(...ROLE_GROUPS.pharmacy), validate(deleteMedicineSchema), async (req, res) => {
    try {
        const kodeParam = req.params.kode as string;
        // Optional: you can choose to soft-delete by changing status if there are FK constraints
        await db.delete(medicines).where(eq(medicines.kodeObat, kodeParam));
        res.json({ success: true, message: 'Item deleted' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete medicine', details: error.message });
    }
});

export const inventoryRouter = router;
