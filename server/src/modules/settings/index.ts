import { Router } from 'express';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { settings } from '../../db/schemas/settings';
import type { DbOrTx } from '../../db/types';
import { DEFAULT_ROOM_TARIFF, DEFAULT_SERVICE_TARIFF, parseTariff, type LayananKey } from '../../../../shared/tariff';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';


const router = Router();

// Sensible defaults for display keys when nothing is stored yet.
const PUBLIC_DEFAULTS: Record<string, string> = {
    namaRS: 'RS SIMRS Tipe D',
    alamatRS: '-',
    jamLayanan: '24 Jam',
};

const PUBLIC_KEYS = ['namaRS', 'alamatRS', 'jamLayanan'];

// Only these keys may be written; anything else in the payload is ignored.
const ALLOWED_KEYS = ['namaRS', 'alamatRS', 'jamLayanan', 'tarifKamar', 'tarifLayanan'];

async function readSetting(conn: DbOrTx, key: string): Promise<string | null> {
    const rows = await conn.select().from(settings).where(eq(settings.key, key)).limit(1);
    return rows[0]?.value ?? null;
}

/** Room tariff per class per day, from the `tarifKamar` setting merged over defaults. */
export const getRoomTariffs = async (conn: DbOrTx = db): Promise<Record<string, number>> =>
    parseTariff(await readSetting(conn, 'tarifKamar'), DEFAULT_ROOM_TARIFF);

/** Per-service tariffs (konsultasi, lab, radiologi), from the `tarifLayanan` setting merged over defaults. */
export const getServiceTariffs = async (conn: DbOrTx = db): Promise<Record<LayananKey, number>> =>
    parseTariff(await readSetting(conn, 'tarifLayanan'), DEFAULT_SERVICE_TARIFF);

// Public display settings for kiosk / queue ticket — no auth required.
router.get('/public', asyncHandler(async (_req, res) => {
    const rows = await db.select().from(settings).where(inArray(settings.key, PUBLIC_KEYS));
    const result: Record<string, string> = { ...PUBLIC_DEFAULTS };
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
}));

// All settings as key -> value — admin only.
router.get('/', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
    const rows = await db.select().from(settings);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
}));

const saveSchema = z.object({
    body: z.object({
        settings: z.record(z.string().min(1), z.string().max(500)).refine(
            (entries) => Object.keys(entries).length <= 20,
            { message: 'Maksimal 20 pengaturan per permintaan' },
        ),
    }),
});

// Upsert settings — admin only. Non-whitelisted keys are silently ignored.
router.put('/', requireAuth, requireRole('admin'), validate(saveSchema), asyncHandler(async (req, res) => {
    const requested: Record<string, string> = req.body.settings;
    const allowed = Object.keys(requested).filter((key) => ALLOWED_KEYS.includes(key));

    for (const key of allowed) {
        await db.insert(settings)
            .values({ key, value: requested[key] })
            .onConflictDoUpdate({
                target: settings.key,
                set: { value: requested[key], updatedAt: new Date() },
            });
    }

    res.json({ success: true, saved: allowed.length });
}));

export const settingsRouter = router;
