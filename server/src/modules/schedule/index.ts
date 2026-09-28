import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { doctorSchedules, queues } from '../../db/schemas/schedule';
import { users } from '../../db/schemas/auth';
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { DomainError } from '../../utils/domain-error';
import { emitQueueCalled, emitQueueUpdate } from '../../utils/websocket';
import { DOCTOR_ROLES } from '../../../../shared/access';

const router = Router();

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const scheduleBody = z.object({
    doctorId: z.string().min(1, 'Dokter wajib dipilih'),
    poliId: z.string().min(1, 'Poli wajib diisi').max(50),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam HH:mm'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam HH:mm'),
    quota: z.coerce.number().int().min(0),
    isActive: z.coerce.number().int().min(0).max(1),
});
const scheduleSchema = z.object({ body: scheduleBody });
const scheduleIdSchema = z.object({ params: z.object({ id: z.coerce.number().int().positive() }), body: scheduleBody });
const poliSchema = z.object({ body: z.object({ poliId: z.string().min(1) }) });

async function assertDoctor(doctorId: string) {
    const [doc] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.id, doctorId), inArray(users.role, [...DOCTOR_ROLES]))).limit(1);
    if (!doc) throw new DomainError('Dokter tidak ditemukan', 400);
}

// GET all schedules (any signed-in user — pickers and the display board use it)
router.get('/', requireAuth, asyncHandler(async (_req, res) => {
    const data = await db.select({
        id: doctorSchedules.id,
        doctorId: doctorSchedules.doctorId,
        doctorName: users.name,
        poliId: doctorSchedules.poliId,
        dayOfWeek: doctorSchedules.dayOfWeek,
        startTime: doctorSchedules.startTime,
        endTime: doctorSchedules.endTime,
        quota: doctorSchedules.quota,
        isActive: doctorSchedules.isActive,
    }).from(doctorSchedules)
        .leftJoin(users, eq(doctorSchedules.doctorId, users.id))
        .orderBy(asc(doctorSchedules.dayOfWeek), asc(doctorSchedules.startTime));
    res.json(data);
}));

router.post('/', requireAuth, requireRole('registration'), validate(scheduleSchema), asyncHandler(async (req, res) => {
    await assertDoctor(req.body.doctorId);
    const [created] = await db.insert(doctorSchedules).values(req.body).returning();
    res.status(201).json(created);
}));

router.put('/:id', requireAuth, requireRole('registration'), validate(scheduleIdSchema), asyncHandler(async (req, res) => {
    await assertDoctor(req.body.doctorId);
    await db.update(doctorSchedules).set(req.body).where(eq(doctorSchedules.id, Number(req.params.id)));
    res.json({ success: true });
}));

router.delete('/:id', requireAuth, requireRole('registration'), asyncHandler(async (req, res) => {
    await db.delete(doctorSchedules).where(eq(doctorSchedules.id, Number(req.params.id)));
    res.json({ success: true });
}));

export interface PoliQueueSummary {
    poli: string;
    dokter: string | null;
    sedangDilayani: string | null;
    loket: string | null;
    sisa: number;
    total: number;
}

// GET today's queue per poli: current number, remaining, total, today's doctor on schedule
router.get('/queues/display', requireAuth, asyncHandler(async (_req, res) => {
    const today = await db.select().from(queues).where(gte(queues.createdAt, startOfToday())).orderBy(asc(queues.queueNumber));
    const onDuty = await db.select({ poliId: doctorSchedules.poliId, name: users.name })
        .from(doctorSchedules)
        .innerJoin(users, eq(doctorSchedules.doctorId, users.id))
        .where(and(eq(doctorSchedules.dayOfWeek, new Date().getDay()), eq(doctorSchedules.isActive, 1)));

    const byPoli: Record<string, PoliQueueSummary> = {};
    for (const q of today) {
        const s = byPoli[q.poliId] ??= {
            poli: q.poliId, dokter: onDuty.find((d) => d.poliId === q.poliId)?.name ?? null,
            sedangDilayani: null, loket: null, sisa: 0, total: 0,
        };
        if (q.status === 'batal') continue;
        s.total += 1;
        if (q.status === 'menunggu') s.sisa += 1;
        if (q.status === 'dipanggil' || q.status === 'diperiksa') {
            s.sedangDilayani = q.queueCode;
            s.loket = q.loket;
        }
    }
    res.json(Object.values(byPoli));
}));

async function callNext(poliId: string, currentStatus: 'selesai' | 'dilewati') {
    const today = startOfToday();
    const [next] = await db.select().from(queues)
        .where(and(eq(queues.poliId, poliId), eq(queues.status, 'menunggu'), gte(queues.createdAt, today)))
        .orderBy(asc(queues.queueNumber)).limit(1);

    await db.update(queues)
        .set({ status: currentStatus, finishedAt: new Date() })
        .where(and(eq(queues.poliId, poliId), eq(queues.status, 'dipanggil'), gte(queues.createdAt, today)));

    if (next) {
        await db.update(queues).set({ status: 'dipanggil', calledAt: new Date() }).where(eq(queues.id, next.id));
        emitQueueCalled(poliId, next.queueCode ?? String(next.queueNumber), next.loket ?? undefined);
    }
    emitQueueUpdate(poliId, { sedangDilayani: next?.queueCode ?? null });
    return next ?? null;
}

// POST call the next waiting number (current one is marked selesai)
router.post('/queues/next', requireAuth, requireRole('registration', 'clinical'), validate(poliSchema), asyncHandler(async (req, res) => {
    const called = await callNext(req.body.poliId, 'selesai');
    res.json({ called });
}));

// POST skip the current number (patient absent) and call the next
router.post('/queues/skip', requireAuth, requireRole('registration', 'clinical'), validate(poliSchema), asyncHandler(async (req, res) => {
    const called = await callNext(req.body.poliId, 'dilewati');
    res.json({ called });
}));

// POST re-announce the number currently being served
router.post('/queues/recall', requireAuth, requireRole('registration', 'clinical'), validate(poliSchema), asyncHandler(async (req, res) => {
    const [current] = await db.select().from(queues)
        .where(and(eq(queues.poliId, req.body.poliId), eq(queues.status, 'dipanggil'), gte(queues.createdAt, startOfToday())))
        .limit(1);
    if (!current) throw new DomainError('Belum ada nomor yang dipanggil di poli ini', 409);
    emitQueueCalled(current.poliId, current.queueCode ?? String(current.queueNumber), current.loket ?? undefined);
    res.json({ recalled: current.queueCode });
}));

export const scheduleRouter = router;
