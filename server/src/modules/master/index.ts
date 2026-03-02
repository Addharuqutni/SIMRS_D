import { Router } from 'express';
import { db } from '../../db';
import { users } from '../../db/schemas/auth';
import { requireAuth } from '../../middleware/auth';
import { eq, like } from 'drizzle-orm';

const router = Router();

// GET all users
router.get('/users', requireAuth, async (req, res) => {
    try {
        const data = await db.select().from(users);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST new user
router.post('/users', requireAuth, async (req, res) => {
    try {
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
    } catch (error: any) {
        console.error('[POST /users] Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
});

// PUT update user
router.put('/users/:id', requireAuth, async (req, res) => {
    try {
        const { nama, email, role, unit, status } = req.body;
        await db.update(users)
            .set({ name: nama, email, role, unit, status, updatedAt: new Date() })
            .where(eq(users.id, req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        console.error('[PUT /users/:id] Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
});

// DELETE user
router.delete('/users/:id', requireAuth, async (req, res) => {
    try {
        await db.delete(users).where(eq(users.id, req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// GET active doctors
router.get('/doctors', requireAuth, async (req, res) => {
    try {
        const data = await db.select().from(users).where(like(users.role, 'Dokter%'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch doctors' });
    }
});

export const masterRouter = router;
