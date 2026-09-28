import { Router } from 'express';
import { db } from '../../db';
import { visits, patients } from '../../db/schemas/patient';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { users } from '../../db/schemas/auth';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { medicines } from '../../db/schemas/inventory';
import { createResepSchema } from '../pharmacy/schema';
import { createResep } from '../pharmacy/dispensing';
import { eRecipeSecret, generateERecipe } from '../../utils/erecipe';
import { DomainError, notFound } from '../../utils/domain-error';
import { ROLES } from '../../../../shared/access';

const router = Router();

// POST e-Resep — the prescriber is the signed-in doctor
router.post('/prescription', requireAuth, requireRole('prescribe'), validate(createResepSchema), asyncHandler(async (req, res) => {
    const resep = await createResep(db, { ...req.body, dokterId: req.user!.id });
    res.status(201).json(resep);
}));

// ==========================================
// E-RECIPE KEMENKES — Sign prescription & generate QR payload
// ==========================================

// POST /clinical/prescription/:id/sign-e-recipe — only the prescribing doctor (or Superadmin) may sign
router.post('/prescription/:id/sign-e-recipe', requireAuth, requireRole('prescribe'), asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [presc] = await db.select({
        id: prescriptions.id,
        noResep: prescriptions.noResep,
        visitId: prescriptions.visitId,
        dokterId: prescriptions.dokterId,
        dokterName: users.name,
    })
        .from(prescriptions)
        .leftJoin(users, eq(prescriptions.dokterId, users.id))
        .where(eq(prescriptions.id, id))
        .limit(1);
    if (!presc) throw notFound('Resep');
    if (presc.dokterId !== req.user!.id && req.user!.role !== ROLES.SUPERADMIN) {
        throw new DomainError('Hanya dokter penulis resep yang dapat menandatangani e-Recipe', 403);
    }

    // Get visit + patient
    const visitRows = await db.select({
        patientId: visits.patientId,
        patientName: patients.nama,
        rm: patients.rm,
        nik: patients.nik,
        tanggalLahir: patients.tanggalLahir,
    })
        .from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(visits.id, presc.visitId))
        .limit(1);

    if (!visitRows.length) throw notFound('Kunjungan');
    const pat = visitRows[0];

    // Get prescription items + medicine details
    const itemRows = await db.select({
        kodeObat: medicines.kodeObat,
        namaObat: medicines.nama,
        satuan: medicines.satuan,
        dosis: prescriptionItems.dosis,
        jumlah: prescriptionItems.jumlah,
        keterangan: prescriptionItems.keterangan,
    })
        .from(prescriptionItems)
        .leftJoin(medicines, eq(prescriptionItems.obatId, medicines.id))
        .where(eq(prescriptionItems.prescriptionId, id));

    const { payload, qrString } = generateERecipe({
        noResep: presc.noResep,
        dokter: { nama: presc.dokterName || 'Dokter', sip: presc.dokterId },
        pasien: {
            nama: pat.patientName || '',
            rm: pat.rm || '',
            nik: pat.nik || undefined,
            tanggalLahir: pat.tanggalLahir || undefined,
        },
        items: itemRows.map((i) => ({
            kodeObat: i.kodeObat || '',
            namaObat: i.namaObat || '',
            dosis: i.dosis,
            jumlah: i.jumlah,
            satuan: i.satuan || undefined,
            signa: i.keterangan || undefined,
        })),
    }, eRecipeSecret());

    // Persist the e-Recipe code + QR payload
    await db.update(prescriptions)
        .set({
            eRecipeCode: payload.kodeUnik,
            eRecipeQrPayload: JSON.stringify(payload),
            eRecipeSignedAt: new Date(),
        })
        .where(eq(prescriptions.id, id));

    res.json({
        success: true,
        eRecipeCode: payload.kodeUnik,
        qrString,
        payload,
    });
}));

export const resepRouter = router;
