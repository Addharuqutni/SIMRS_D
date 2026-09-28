import { Router } from 'express';
import { db } from '../../db';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { visits, patients } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { medicines } from '../../db/schemas/inventory';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { countsByStatus, readPageParams, toPage } from '../../utils/pagination';
import { notFound } from '../../utils/domain-error';
import { dispense, startProses } from './dispensing';
import { resepStatusSchema } from './schema';

const router = Router();

const listColumns = {
    id: prescriptions.id,
    noResep: prescriptions.noResep,
    visitId: prescriptions.visitId,
    dokterId: prescriptions.dokterId,
    status: prescriptions.status,
    waktuResep: prescriptions.waktuResep,
    waktuSelesai: prescriptions.waktuSelesai,
    patientName: patients.nama,
    rm: patients.rm,
    dokterName: users.name,
};

// GET prescriptions — paginated, search by no resep / patient / RM, per-status counts
router.get('/prescriptions', requireAuth, requireRole('pharmacy', 'prescribe'), asyncHandler(async (req, res) => {
    const p = readPageParams(req);
    const search = p.q
        ? or(ilike(prescriptions.noResep, `%${p.q}%`), ilike(patients.nama, `%${p.q}%`), ilike(patients.rm, `%${p.q}%`))
        : undefined;

    const [rows, statusRows] = await Promise.all([
        db.select(listColumns).from(prescriptions)
            .leftJoin(visits, eq(prescriptions.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(prescriptions.dokterId, users.id))
            .where(and(search, p.status ? eq(prescriptions.status, p.status) : undefined))
            .orderBy(desc(prescriptions.waktuResep))
            .limit(p.limit).offset(p.offset),
        db.select({ status: prescriptions.status, n: count() }).from(prescriptions)
            .leftJoin(visits, eq(prescriptions.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(search).groupBy(prescriptions.status),
    ]);
    const counts = countsByStatus(statusRows);
    const total = p.status ? (counts[p.status] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0);
    res.json(toPage(rows, total, p, counts));
}));

// GET one prescription with items and current stock
router.get('/prescriptions/:id', requireAuth, requireRole('pharmacy', 'prescribe'), asyncHandler(async (req, res) => {
    const [presc] = await db.select(listColumns).from(prescriptions)
        .leftJoin(visits, eq(prescriptions.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .leftJoin(users, eq(prescriptions.dokterId, users.id))
        .where(eq(prescriptions.id, req.params.id))
        .limit(1);
    if (!presc) throw notFound('Resep');

    const items = await db.select({
        id: prescriptionItems.id,
        obatId: prescriptionItems.obatId,
        dosis: prescriptionItems.dosis,
        jumlah: prescriptionItems.jumlah,
        keterangan: prescriptionItems.keterangan,
        namaObat: medicines.nama,
        stok: medicines.stok,
    })
        .from(prescriptionItems)
        .leftJoin(medicines, eq(prescriptionItems.obatId, medicines.id))
        .where(eq(prescriptionItems.prescriptionId, presc.id));

    res.json({ ...presc, items });
}));

// PUT move a prescription forward: proses (accepted) or selesai (dispensed — deducts stock and bills)
router.put('/prescriptions/:id/status', requireAuth, requireRole('pharmacy'), validate(resepStatusSchema), asyncHandler(async (req, res) => {
    const updated = req.body.status === 'proses'
        ? await startProses(db, req.params.id)
        : await dispense(db, req.params.id, req.user?.name ?? 'system');
    res.json(updated);
}));

export const pharmacyRouter = router;
