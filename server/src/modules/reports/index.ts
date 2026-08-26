import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { billings, transactions } from '../../db/schemas/billing';
import { visits, patients } from '../../db/schemas/patient';
import { emrSoap } from '../../db/schemas/clinical';
import { prescriptions } from '../../db/schemas/services';
import { icd10Codes } from '../../db/schemas/icd10';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { ROLE_GROUPS } from '../../utils/roles';
import { desc, sql, gte, lte, lt, and, eq, ne, isNull, inArray } from 'drizzle-orm';

const router = Router();

const sendCsv = (res: Response, filename: string, header: string[], rows: (string | number)[][]) => {
    const csvRows = [header.join(',')];
    for (const row of rows) {
        csvRows.push(row.join(','));
    }
    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
};

// GET /api/v1/reports/dashboard — summary stats for the landing page (all roles)
router.get('/dashboard', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWindow = new Date(startOfToday);
    startOfWindow.setDate(startOfWindow.getDate() - 6);
    const endOfWindow = new Date(startOfToday);
    endOfWindow.setDate(endOfWindow.getDate() + 1);

    // 7-day visit trend ending today. Grouped per day via to_char (server-local
    // dates, same clock as the JS boundaries above). Soft-deleted patients
    // excluded, matching /rl.
    const trendRows = await db
        .select({
            tanggal: sql<string>`to_char(${visits.waktuDaftar}, 'YYYY-MM-DD')`,
            jumlah: sql<number>`count(*)::int`,
        })
        .from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(and(
            gte(visits.waktuDaftar, startOfWindow),
            lt(visits.waktuDaftar, endOfWindow),
            isNull(patients.deletedAt),
        ))
        .groupBy(sql`to_char(${visits.waktuDaftar}, 'YYYY-MM-DD')`);

    const byDate = new Map(trendRows.map(r => [r.tanggal, Number(r.jumlah)]));
    const trenKunjungan = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWindow);
        d.setDate(d.getDate() + i);
        const tanggal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { tanggal, jumlah: byDate.get(tanggal) ?? 0 };
    });
    // Today is the last bucket of the trend — reuse it instead of a second query.
    const kunjunganHariIni = trenKunjungan[6].jumlah;

    const [pasienRows, resepRows, tagihanRows] = await Promise.all([
        db.select({ jumlah: sql<number>`count(*)::int` })
            .from(patients)
            .where(isNull(patients.deletedAt)),
        db.select({ jumlah: sql<number>`count(*)::int` })
            .from(prescriptions)
            .where(eq(prescriptions.status, 'baru')),
        db.select({
            jumlah: sql<number>`count(*)::int`,
            total: sql<number>`coalesce(sum(${billings.total}), 0)::int`,
        })
            .from(billings)
            .where(ne(billings.status, 'paid')),
    ]);

    res.json({
        success: true,
        data: {
            kunjunganHariIni,
            totalPasien: Number(pasienRows[0]?.jumlah ?? 0),
            resepBaru: Number(resepRows[0]?.jumlah ?? 0),
            tagihanOpen: {
                count: Number(tagihanRows[0]?.jumlah ?? 0),
                total: Number(tagihanRows[0]?.total ?? 0),
            },
            trenKunjungan,
        }
    });
}));

// GET /api/v1/reports/finance/summary
router.get('/finance/summary', requireAuth, requireRole(...ROLE_GROUPS.billing), asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    let conditions = [];
    if (startDate) conditions.push(gte(transactions.tanggal, new Date(startDate as string)));
    if (endDate) conditions.push(lte(transactions.tanggal, new Date(endDate as string)));

    const result = await db
        .select({
            jenis: transactions.jenis,
            total: sql<number>`sum(${transactions.jumlah})`,
        })
        .from(transactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(transactions.jenis);

    // transactions.jenis values are lowercase ('pendapatan' | 'piutang' | 'biaya',
    // see modules/billing pay flow + db/schemas/billing.ts) — pg sum() returns a string, so cast.
    const totalOf = (jenis: string) => Number(result.find(r => r.jenis === jenis)?.total ?? 0);

    res.json({
        success: true,
        data: result,
        summary: {
            totalPemasukan: totalOf('pendapatan'),
            totalPiutang: totalOf('piutang'),
            totalPengeluaran: totalOf('biaya'),
        }
    });
}));

// GET /api/v1/reports/finance/export-csv
router.get('/finance/export-csv', requireAuth, requireRole(...ROLE_GROUPS.billing), asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    let conditions = [];
    if (startDate) conditions.push(gte(transactions.tanggal, new Date(startDate as string)));
    if (endDate) conditions.push(lte(transactions.tanggal, new Date(endDate as string)));

    const data = await db
        .select()
        .from(transactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(transactions.tanggal));

    sendCsv(
        res,
        `finance_report_${new Date().toISOString().split('T')[0]}.csv`,
        ['ID', 'Kategori', 'Keterangan', 'Jenis', 'Jumlah', 'Tanggal'],
        data.map((row) => [
            row.id,
            `"${row.kategori}"`,
            `"${row.keterangan || ''}"`,
            row.jenis,
            row.jumlah,
            new Date(row.tanggal).toISOString()
        ])
    );
}));

// GET /api/v1/reports/visits/export-csv
router.get('/visits/export-csv', requireAuth, requireRole(...ROLE_GROUPS.billing), asyncHandler(async (req: Request, res: Response) => {
    const data = await db.select().from(visits).orderBy(desc(visits.waktuDaftar));

    sendCsv(
        res,
        `visits_report_${new Date().toISOString().split('T')[0]}.csv`,
        ['ID Visit', 'Patient ID', 'Poli ID', 'Dokter ID', 'Jaminan', 'Status', 'Waktu Daftar'],
        data.map((row) => [
            row.id,
            row.patientId,
            `"${row.poliId}"`,
            `"${row.dokterId}"`,
            `"${row.jaminan}"`,
            `"${row.status}"`,
            new Date(row.waktuDaftar).toISOString()
        ])
    );
}));

// GET /api/v1/reports/rl?year=&month=            -> JSON RL-style monthly per-poli visit counts
// GET /api/v1/reports/rl?year=&month=&format=csv  -> CSV download (rl_<year>_<month>.csv)
router.get('/rl', requireAuth, requireRole(...ROLE_GROUPS.billing), asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const year = parseInt(req.query.year as string, 10) || now.getFullYear();
    const month = parseInt(req.query.month as string, 10) || now.getMonth() + 1;

    if (year < 1900 || year > 2200 || month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid period. year: 1900-2200, month: 1-12' });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    // visits.tipeKunjungan distinguishes rawat_jalan / igd / rawat_inap (db/schemas/patient.ts).
    // Joined with patients to exclude soft-deleted patients.
    const rows = await db
        .select({
            tipeKunjungan: visits.tipeKunjungan,
            poli: visits.poliId,
            jumlah: sql<number>`count(*)::int`,
        })
        .from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(and(
            gte(visits.waktuDaftar, start),
            lt(visits.waktuDaftar, end),
            isNull(patients.deletedAt),
        ))
        .groupBy(visits.tipeKunjungan, visits.poliId);

    const TIPE_LABELS: Record<string, string> = {
        rawat_jalan: 'Rawat Jalan',
        rawat_inap: 'Rawat Inap',
        igd: 'IGD',
    };

    const grouped: Record<string, { poli: string; jumlah: number }[]> = {};
    for (const row of rows) {
        const key = row.tipeKunjungan in TIPE_LABELS ? row.tipeKunjungan : 'lainnya';
        (grouped[key] ??= []).push({ poli: row.poli, jumlah: Number(row.jumlah) });
    }
    for (const list of Object.values(grouped)) list.sort((a, b) => b.jumlah - a.jumlah);

    if (req.query.format === 'csv') {
        const csvRows = Object.entries(grouped).flatMap(([key, list]) =>
            list.map(item => [`"${TIPE_LABELS[key] ?? 'Lainnya'}"`, `"${item.poli}"`, item.jumlah])
        );
        return sendCsv(res, `rl_${year}_${month}.csv`, ['Jenis Kunjungan', 'Poli', 'Jumlah Kunjungan'], csvRows);
    }

    res.json({
        success: true,
        data: {
            year,
            month,
            rawatJalan: grouped['rawat_jalan'] ?? [],
            rawatInap: grouped['rawat_inap'] ?? [],
            igd: grouped['igd'] ?? [],
            lainnya: grouped['lainnya'] ?? [],
        }
    });
}));

// GET /api/v1/reports/rl2b?year=&month=            -> JSON RL 2b morbiditas per diagnosa (ICD-10)
// GET /api/v1/reports/rl2b?year=&month=&format=csv  -> CSV download (rl2b_<year>_<month>.csv)
router.get('/rl2b', requireAuth, requireRole(...ROLE_GROUPS.billing), asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const year = parseInt(req.query.year as string, 10) || now.getFullYear();
    const month = parseInt(req.query.month as string, 10) || now.getMonth() + 1;

    if (year < 1900 || year > 2200 || month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid period. year: 1900-2200, month: 1-12' });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    // SOAP notes for visits registered in the period; patients joined to exclude soft-deleted.
    const rows = await db
        .select({ icd10Codes: emrSoap.icd10Codes })
        .from(emrSoap)
        .innerJoin(visits, eq(emrSoap.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(and(
            gte(visits.waktuDaftar, start),
            lt(visits.waktuDaftar, end),
            isNull(patients.deletedAt),
        ));

    // emrSoap.icd10Codes is a JSON string array (db/schemas/clinical.ts) —
    // volume per month is small, so aggregate in JS. Empty arrays contribute nothing.
    const counts = new Map<string, number>();
    for (const row of rows) {
        let codes: unknown;
        try {
            codes = JSON.parse(row.icd10Codes ?? '[]');
        } catch {
            codes = [];
        }
        if (!Array.isArray(codes)) continue;
        for (const code of codes) {
            if (typeof code !== 'string' || code.trim() === '') continue;
            const key = code.trim();
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }

    // Descriptions from the reference table; codes missing from it still appear (description '').
    const refs = counts.size > 0
        ? await db.select().from(icd10Codes).where(inArray(icd10Codes.code, [...counts.keys()]))
        : [];
    const descriptions = new Map(refs.map(ref => [ref.code, ref.description]));

    const diagnosa = [...counts.entries()]
        .map(([code, jumlah]) => ({ code, description: descriptions.get(code) ?? '', jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah || a.code.localeCompare(b.code));

    if (req.query.format === 'csv') {
        return sendCsv(res, `rl2b_${year}_${month}.csv`,
            ['Kode ICD-10', 'Deskripsi', 'Jumlah Kasus'],
            diagnosa.map(d => [
                `"${d.code}"`,
                `"${d.description.replace(/"/g, '""')}"`,
                d.jumlah,
            ])
        );
    }

    res.json({
        success: true,
        data: {
            year,
            month,
            diagnosa,
        }
    });
}));

export const reportsRouter = router;
