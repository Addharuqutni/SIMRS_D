import { Router } from 'express';
import { db } from '../../db';
import { auditLogs } from '../../db/schemas/audit';
import { count, desc, eq, gte, ilike, lt, lte, and, type SQL } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { readPageParams, toPage } from '../../utils/pagination';
import { DomainError } from '../../utils/domain-error';
import { sendCsv } from '../../utils/csv';

const router = Router();

const MAX_EXPORT_DAYS = 365;
const DEFAULT_PURGE_DAYS = 90;
const MIN_PURGE_DAYS = 30;

interface AuditFilter {
    userId?: string;
    method?: string;
    path?: string;
    startDate?: string;
    endDate?: string;
}

/** Reads the optional audit filters shared by the list and export endpoints. */
function readFilters(req: { query: Record<string, unknown> }): AuditFilter {
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    return {
        userId: str(req.query.userId),
        method: str(req.query.method)?.toUpperCase(),
        path: str(req.query.path),
        startDate: str(req.query.startDate),
        endDate: str(req.query.endDate),
    };
}

function whereOf(f: AuditFilter, extra?: SQL): SQL | undefined {
    const conditions: (SQL | undefined)[] = [
        f.userId ? eq(auditLogs.userId, f.userId) : undefined,
        f.method ? eq(auditLogs.method, f.method) : undefined,
        f.path ? ilike(auditLogs.path, `%${f.path}%`) : undefined,
        f.startDate ? gte(auditLogs.createdAt, parseDate(f.startDate, 'startDate')) : undefined,
        f.endDate ? lte(auditLogs.createdAt, endOfDay(parseDate(f.endDate, 'endDate'))) : undefined,
        extra,
    ];
    const present = conditions.filter((c): c is SQL => c !== undefined);
    return present.length ? and(...present) : undefined;
}

function parseDate(value: string, field: string): Date {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new DomainError(`Filter ${field} bukan tanggal yang valid`, 400);
    return d;
}

function endOfDay(d: Date): Date {
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return end;
}

// GET /api/v1/audit-logs — paginated audit trail viewer (Superadmin).
// Filters: userId, method, path, startDate, endDate. Page/limit/q via readPageParams.
router.get('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const search = p.q ? ilike(auditLogs.path, `%${p.q}%`) : undefined;
    const where = whereOf(readFilters(req), search);

    const [rows, countRows] = await Promise.all([
        db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(p.limit).offset(p.offset),
        db.select({ n: count() }).from(auditLogs).where(where),
    ]);
    const total = Number(countRows[0]?.n ?? 0);
    res.json(toPage(rows, total, p));
}));

// GET /api/v1/audit-logs/export — CSV download, bounded to a one-year window
// (same cap as the finance report exports) so a stale filter cannot dump the table.
router.get('/export', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const f = readFilters(req);
    const start = f.startDate ? parseDate(f.startDate, 'startDate') : undefined;
    const end = f.endDate ? endOfDay(parseDate(f.endDate, 'endDate')) : undefined;
    if (start && end && end.getTime() - start.getTime() > MAX_EXPORT_DAYS * 86_400_000) {
        throw new DomainError('Rentang ekspor maksimal 1 tahun', 400);
    }

    const rows = await db.select().from(auditLogs)
        .where(whereOf(f))
        .orderBy(desc(auditLogs.createdAt));

    sendCsv(
        res,
        `audit_export_${new Date().toISOString().split('T')[0]}.csv`,
        ['waktu', 'user', 'ip', 'method', 'status_code', 'path', 'body'],
        rows.map((row) => [row.createdAt, row.userName, row.ip, row.method, row.statusCode, row.path, row.body])
    );
}));

// DELETE /api/v1/audit-logs/purge — drop rows older than ?days= (default 90, minimum 30)
router.delete('/purge', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const parsedDays = Number.parseInt(String(req.query.days ?? ''), 10);
    const days = Number.isFinite(parsedDays) ? Math.max(parsedDays, MIN_PURGE_DAYS) : DEFAULT_PURGE_DAYS;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const deleted = await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff)).returning({ id: auditLogs.id });

    res.json({ success: true, deleted: deleted.length, cutoff: cutoff.toISOString() });
}));

export const auditRouter = router;
