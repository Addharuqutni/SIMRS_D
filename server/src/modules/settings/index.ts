import { Router } from 'express';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { settings } from '../../db/schemas/settings';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { ROLE_GROUPS } from '../../utils/roles';

const router = Router();

// Sensible defaults for display keys when nothing is stored yet.
const PUBLIC_DEFAULTS: Record<string, string> = {
    namaRS: 'RS SIMRS Tipe D',
    alamatRS: '-',
    jamLayanan: '24 Jam',
};

const PUBLIC_KEYS = ['namaRS', 'alamatRS', 'jamLayanan'];

// Only these keys may be written; anything else in the payload is ignored.
const ALLOWED_KEYS = ['namaRS', 'alamatRS', 'jamLayanan', 'tarifKamar', 'maxPercobaanLogin'];

// Room tariff per class per day (IDR) — fallback when no valid tarifKamar setting exists.
export const DEFAULT_ROOM_TARIFF: Record<string, number> = {
    'Kelas 1': 500000, 'Kelas 2': 350000, 'Kelas 3': 200000,
    'VIP': 750000, 'HCU': 750000, 'ICU': 1000000,
};

/**
 * Room tariffs from the tarifKamar setting (JSON object: kelas -> tarif/hari).
 * Falls back to DEFAULT_ROOM_TARIFF when unset, invalid JSON, or non-numeric values;
 * numeric entries are merged over the defaults so missing classes keep their default.
 */
export const getRoomTariffs = async (): Promise<Record<string, number>> => {
    try {
        const rows = await db.select().from(settings).where(eq(settings.key, 'tarifKamar')).limit(1);
        if (!rows.length) return DEFAULT_ROOM_TARIFF;

        const parsed = JSON.parse(rows[0].value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_ROOM_TARIFF;

        const tariffs: Record<string, number> = { ...DEFAULT_ROOM_TARIFF };
        for (const [kelas, tarif] of Object.entries(parsed)) {
            const n = Number(tarif);
            if (Number.isFinite(n) && n >= 0) tariffs[kelas] = n;
        }
        return tariffs;
    } catch {
        return DEFAULT_ROOM_TARIFF;
    }
};

// Public display settings for kiosk / queue ticket — no auth required.
router.get('/public', asyncHandler(async (_req, res) => {
    const rows = await db.select().from(settings).where(inArray(settings.key, PUBLIC_KEYS));
    const result: Record<string, string> = { ...PUBLIC_DEFAULTS };
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
}));

// All settings as key -> value — admin only.
router.get('/', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (_req, res) => {
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
router.put('/', requireAuth, requireRole(...ROLE_GROUPS.admin), validate(saveSchema), asyncHandler(async (req, res) => {
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
