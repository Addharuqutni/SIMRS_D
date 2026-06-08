import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { billings, transactions } from '../../db/schemas/billing';
import { visits } from '../../db/schemas/patient';
import { requireAuth, requireRole } from '../../middleware/auth';
import { ROLE_GROUPS } from '../../utils/roles';
import { desc, sql, gte, lte, and } from 'drizzle-orm';

const router = Router();

// GET /api/v1/reports/finance/summary
router.get('/finance/summary', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req: Request, res: Response) => {
    try {
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

        res.json({
            success: true,
            data: result,
            summary: {
                totalPemasukan: result.find(r => r.jenis === 'PEMASUKAN')?.total || 0,
                totalPengeluaran: result.find(r => r.jenis === 'PENGELUARAN')?.total || 0,
            }
        });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to fetch finance summary' });
    }
});

// GET /api/v1/reports/finance/export-csv
router.get('/finance/export-csv', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        let conditions = [];
        if (startDate) conditions.push(gte(transactions.tanggal, new Date(startDate as string)));
        if (endDate) conditions.push(lte(transactions.tanggal, new Date(endDate as string)));

        const data = await db
            .select()
            .from(transactions)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(transactions.tanggal));

        // Generate CSV string
        const header = ['ID', 'Kategori', 'Keterangan', 'Jenis', 'Jumlah', 'Tanggal'];
        const csvRows = [header.join(',')];

        for (const row of data) {
            csvRows.push([
                row.id,
                `"${row.kategori}"`,
                `"${row.keterangan || ''}"`,
                row.jenis,
                row.jumlah,
                new Date(row.tanggal).toISOString()
            ].join(','));
        }

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="finance_report_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// GET /api/v1/reports/visits/export-csv
router.get('/visits/export-csv', requireAuth, requireRole(...ROLE_GROUPS.billing), async (req: Request, res: Response) => {
    try {
        const data = await db.select().from(visits).orderBy(desc(visits.waktuDaftar));

        // Generate CSV string
        const header = ['ID Visit', 'Patient ID', 'Poli ID', 'Dokter ID', 'Jaminan', 'Status', 'Waktu Daftar'];
        const csvRows = [header.join(',')];

        for (const row of data) {
            csvRows.push([
                row.id,
                row.patientId,
                `"${row.poliId}"`,
                `"${row.dokterId}"`,
                `"${row.jaminan}"`,
                `"${row.status}"`,
                new Date(row.waktuDaftar).toISOString()
            ].join(','));
        }

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="visits_report_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export visits CSV' });
    }
});

export const reportsRouter = router;
