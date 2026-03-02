import { Router } from 'express';
import { db } from '../../db';
import { doctorSchedules, queues } from '../../db/schemas/schedule';
import { users } from '../../db/schemas/auth';
import { eq, gte, lt, desc, and } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// GET all schedules
router.get('/', requireAuth, async (req, res) => {
    try {
        const data = await db.select({
            id: doctorSchedules.id,
            doctorId: doctorSchedules.doctorId,
            doctorName: users.name,
            poliId: doctorSchedules.poliId,
            dayOfWeek: doctorSchedules.dayOfWeek,
            startTime: doctorSchedules.startTime,
            endTime: doctorSchedules.endTime,
            quota: doctorSchedules.quota,
            isActive: doctorSchedules.isActive
        }).from(doctorSchedules)
            .leftJoin(users, eq(doctorSchedules.doctorId, users.id));

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
    }
});

// POST new schedule
router.post('/', requireAuth, async (req, res) => {
    try {
        const newSchedule = await db.insert(doctorSchedules).values(req.body).returning();
        res.status(201).json(newSchedule[0]);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create schedule', details: error.message });
    }
});

// PUT update schedule
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const idParam = parseInt(req.params.id);
        await db.update(doctorSchedules).set(req.body).where(eq(doctorSchedules.id, idParam));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update schedule', details: error.message });
    }
});

// DELETE schedule
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const idParam = parseInt(req.params.id);
        await db.delete(doctorSchedules).where(eq(doctorSchedules.id, idParam));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete schedule', details: error.message });
    }
});

// GET display queues
router.get('/queues/display', requireAuth, async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch all today's queues
        const todaysQueues = await db.select()
            .from(queues)
            .where(gte(queues.createdAt, startOfDay));

        // Group by poli
        const displayData: Record<string, any> = {};

        todaysQueues.forEach(q => {
            const poli = q.poliId;
            if (!displayData[poli]) {
                displayData[poli] = {
                    poli: poli,
                    dokter: 'Dokter Jaga', // Can be expanded with join if needed
                    sedangDilayani: '-',
                    sisa: 0,
                    total: 0,
                    lastCalledNum: 0
                };
            }
            displayData[poli].total += 1;

            if (q.status === 'menunggu') {
                displayData[poli].sisa += 1;
            } else if (q.status === 'dipanggil' || q.status === 'diperiksa') {
                if (q.queueNumber > displayData[poli].lastCalledNum) {
                    displayData[poli].lastCalledNum = q.queueNumber;
                    displayData[poli].sedangDilayani = q.queueCode;
                }
            }
        });

        res.json(Object.values(displayData));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch queues' });
    }
});

// POST next queue (advance queue)
router.post('/queues/next', requireAuth, async (req, res) => {
    try {
        const { poliId } = req.body;
        if (!poliId) return res.status(400).json({ error: 'poliId required' });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Find the next waiting queue token for this poli
        const nextInLine = await db.select()
            .from(queues)
            .where(
                and(
                    eq(queues.poliId, poliId),
                    eq(queues.status, 'menunggu'),
                    gte(queues.createdAt, startOfDay)
                )
            )
            .orderBy(queues.queueNumber)
            .limit(1);

        if (nextInLine.length === 0) {
            return res.json({ success: false, message: 'Tidak ada antrean menunggu' });
        }

        const queueToCall = nextInLine[0];

        // Mark current active as finished (optional, or just handled by medical record UI)
        await db.update(queues)
            .set({ status: 'selesai' })
            .where(
                and(
                    eq(queues.poliId, poliId),
                    eq(queues.status, 'dipanggil'),
                    gte(queues.createdAt, startOfDay)
                )
            );

        // Mark the new one as called
        await db.update(queues)
            .set({ status: 'dipanggil', calledAt: new Date() })
            .where(eq(queues.id, queueToCall.id));

        res.json({ success: true, message: 'Antrean dilanjutkan', data: queueToCall });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to advance queue', details: error.message });
    }
});

export const scheduleRouter = router;
