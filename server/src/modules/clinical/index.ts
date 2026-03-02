import { Router } from 'express';
import { db } from '../../db';
import { emrSoap, igdTriase, rawatInapAdmisi, labOrders, radiologyOrders } from '../../db/schemas/clinical';
import { visits, patients } from '../../db/schemas/patient';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { users } from '../../db/schemas/auth';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { saveSoapSchema, createPrescriptionSchema, createOrderSchema } from './schema';
import { nanoid } from 'nanoid';

const router = Router();

// ==========================================
// RAWAT JALAN & EMR SOAP
// ==========================================

// GET Rawat Jalan Visits
router.get('/rawat-jalan', requireAuth, async (req, res) => {
    try {
        const data = await db.select({
            id: visits.id,
            nama: patients.nama,
            rm: patients.rm,
            poli: visits.poliId,
            dokter: users.name,
            dokterId: visits.dokterId,
            status: visits.status,
            waktu: visits.waktuDaftar
        }).from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id))
            .where(eq(visits.tipeKunjungan, 'rawat_jalan'))
            .orderBy(desc(visits.waktuDaftar));

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch rawat jalan', details: error.message });
    }
});

// PUT Update Rawat Jalan Status
router.put('/rawat-jalan/:id/status', requireAuth, async (req, res) => {
    try {
        await db.update(visits).set({ status: req.body.status }).where(eq(visits.id, req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update visit status', details: error.message });
    }
});

// GET EMR SOAP for a visit
router.get('/soap/:visitId', requireAuth, async (req, res) => {
    try {
        const data = await db.select().from(emrSoap).where(eq(emrSoap.visitId, req.params.visitId));
        res.json(data[0] || null);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch EMR SOAP', details: error.message });
    }
});

// POST EMR SOAP for a visit
router.post('/soap', requireAuth, validate(saveSoapSchema), async (req, res) => {
    try {
        // Upsert logic (if exists, update, else insert)
        const existing = await db.select().from(emrSoap).where(eq(emrSoap.visitId, req.body.visitId));
        if (existing.length > 0) {
            const updated = await db.update(emrSoap)
                .set({ ...req.body, updatedAt: new Date() })
                .where(eq(emrSoap.visitId, req.body.visitId))
                .returning();
            res.json(updated[0]);
        } else {
            const soap = await db.insert(emrSoap).values({
                id: `SOAP-${Date.now()}`,
                ...req.body
            }).returning();
            res.status(201).json(soap[0]);
        }
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to save EMR SOAP', details: error.message });
    }
});

// POST E-Resep / Prescription
router.post('/prescription', requireAuth, validate(createPrescriptionSchema), async (req, res) => {
    try {
        const { visitId, dokterId, items } = req.body;

        await db.transaction(async (tx) => {
            const prescId = `R/X-${Date.now()}`;
            await tx.insert(prescriptions).values({
                id: prescId,
                noResep: prescId,
                visitId,
                dokterId,
                status: 'baru'
            });

            const insertedItems = items.map((i: any) => ({
                id: nanoid(),
                prescriptionId: prescId,
                obatId: i.obatId,
                dosis: i.dosis,
                jumlah: i.jumlah,
                keterangan: i.keterangan
            }));

            await tx.insert(prescriptionItems).values(insertedItems);
        });

        res.status(201).json({ success: true, message: 'Resep elektronik berhasil dibuat' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create prescription', details: error.message });
    }
});

// POST Orders (Lab / Radiology)
router.post('/orders/:type', requireAuth, validate(createOrderSchema), async (req, res) => {
    try {
        const { type } = req.params;
        const { visitId, dokterId, jenisPemeriksaan, catatan } = req.body;

        if (type === 'lab') {
            const inserted = await db.insert(labOrders).values({
                id: `LAB-${Date.now()}`,
                visitId,
                dokterId,
                jenisPemeriksaan,
                catatan,
                status: 'menunggu'
            }).returning();
            res.status(201).json(inserted[0]);
        } else if (type === 'radiology') {
            const inserted = await db.insert(radiologyOrders).values({
                id: `RAD-${Date.now()}`,
                visitId,
                dokterId,
                jenisPemeriksaan,
                catatan,
                status: 'menunggu'
            }).returning();
            res.status(201).json(inserted[0]);
        }
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to order diagnostics', details: error.message });
    }
});

// ==========================================
// RAWAT INAP (ADMISI)
// ==========================================

// GET Rawat Inap Patients
router.get('/rawat-inap', requireAuth, async (req, res) => {
    try {
        const data = await db.select({
            id: rawatInapAdmisi.id,
            visitId: visits.id,
            rm: patients.rm,
            pasien: patients.nama,
            ruangan: rawatInapAdmisi.ruanganId,
            kelas: rawatInapAdmisi.kelas,
            masuk: rawatInapAdmisi.waktuMasuk,
            dpjp: users.name,
            status: rawatInapAdmisi.status
        }).from(rawatInapAdmisi)
            .leftJoin(visits, eq(rawatInapAdmisi.visitId, visits.id))
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(users, eq(visits.dokterId, users.id))
            .orderBy(desc(rawatInapAdmisi.waktuMasuk));

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch rawat inap', details: error.message });
    }
});

// POST Rawat Inap Admisi
router.post('/rawat-inap/admisi', requireAuth, async (req, res) => {
    try {
        // In real app, you might link to an existing visit or create a new one. 
        // Based on UI form (pasien, ruangan, kelas, dpjp), we will simulate full chain if needed.
        let generatedRM = `RM${Math.floor(100000 + Math.random() * 900000)}`;

        const newPatient = await db.insert(patients).values({
            id: `PAT-${Date.now()}`,
            rm: generatedRM,
            nama: req.body.pasien,
            gender: 'L',
            alamat: 'Rawat Inap'
        }).returning();

        const newVisit = await db.insert(visits).values({
            id: `VST-${Date.now()}`,
            patientId: newPatient[0].id,
            poliId: 'Rawat Inap',
            dokterId: req.body.dpjp || 'dr. Default',
            jaminan: 'Umum / Mandiri',
            tipeKunjungan: 'rawat_inap',
            status: 'dirawat'
        }).returning();

        const admisi = await db.insert(rawatInapAdmisi).values({
            id: `INP-${Date.now()}`,
            visitId: newVisit[0].id,
            ruanganId: req.body.ruangan,
            kelas: req.body.kelas,
            status: 'dirawat'
        }).returning();

        res.status(201).json(admisi[0]);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create admisi rawat inap', details: error.message });
    }
});

// PUT Update Rawat Inap Status
router.put('/rawat-inap/:id/status', requireAuth, async (req, res) => {
    try {
        await db.update(rawatInapAdmisi)
            .set({
                status: req.body.status,
                waktuKeluar: req.body.status === 'pulang' ? new Date() : null
            })
            .where(eq(rawatInapAdmisi.id, req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update rawat inap status', details: error.message });
    }
});

export const clinicalRouter = router;
