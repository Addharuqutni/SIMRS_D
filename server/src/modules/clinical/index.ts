import { Router } from 'express';
import { db } from '../../db';
import { emrSoap, igdTriase, rawatInapAdmisi, labOrders, radiologyOrders, vitalSigns, emrProgressNotes } from '../../db/schemas/clinical';
import { visits, patients } from '../../db/schemas/patient';
import { prescriptions, prescriptionItems } from '../../db/schemas/services';
import { users } from '../../db/schemas/auth';
import { notifications } from '../../db/schemas/notify';
import { eq, desc, and, or, ilike } from 'drizzle-orm';
import { requireAuth, requireRole } from '../../middleware/auth';
import { ROLE_GROUPS } from '../../utils/roles';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { icd10Codes } from '../../db/schemas/icd10';
import { icd9Codes } from '../../db/schemas/icd9';
import { medicines } from '../../db/schemas/inventory';
import { saveSoapSchema, saveVitalSignsSchema, saveProgressNoteSchema, createPrescriptionSchema, createOrderSchema } from './schema';
import { computeMews, mewsActionFor } from '../../utils/mews';
import { nanoid } from 'nanoid';

const router = Router();

// ==========================================
// RAWAT JALAN & EMR SOAP
// ==========================================

// GET Rawat Jalan Visits
router.get('/rawat-jalan', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const data = await db.select({
        id: visits.id,
        nama: patients.nama,
        rm: patients.rm,
        alergi: patients.alergi,
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
}));

// PUT Update Rawat Jalan Status
router.put('/rawat-jalan/:id/status', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    await db.update(visits).set({ status: req.body.status }).where(eq(visits.id, req.params.id));
    res.json({ success: true });
}));

// GET ICD-10 diagnosis codes (search by code or description)
router.get('/icd10', requireAuth, asyncHandler(async (req, res) => {
    const q = ((req.query.q as string) || '').trim();
    if (q.length < 2) {
        res.json([]);
        return;
    }

    const pattern = `%${q}%`;
    const data = await db.select().from(icd10Codes)
        .where(or(ilike(icd10Codes.code, pattern), ilike(icd10Codes.description, pattern)))
        .orderBy(icd10Codes.code)
        .limit(20);

    res.json(data);
}));

// GET ICD-9-CM procedure codes (search by code or description)
router.get('/icd9', requireAuth, asyncHandler(async (req, res) => {
    const q = ((req.query.q as string) || '').trim();
    if (q.length < 2) {
        res.json([]);
        return;
    }

    const pattern = `%${q}%`;
    const data = await db.select().from(icd9Codes)
        .where(or(ilike(icd9Codes.code, pattern), ilike(icd9Codes.description, pattern)))
        .orderBy(icd9Codes.code)
        .limit(20);

    res.json(data);
}));

// GET lightweight medicines list for prescription picker (clinical roles;
// /inventory itself is pharmacy-only)
router.get('/medicines', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const data = await db.select({
        id: medicines.id,
        kodeObat: medicines.kodeObat,
        nama: medicines.nama,
        satuan: medicines.satuan,
        stok: medicines.stok,
    }).from(medicines).orderBy(medicines.nama);

    res.json(data);
}));

// GET EMR SOAP for a visit
router.get('/soap/:visitId', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const data = await db.select().from(emrSoap).where(eq(emrSoap.visitId, req.params.visitId));
    if (!data[0]) {
        res.json(null);
        return;
    }

    // icd10Codes / icd9Codes are stored as JSON strings — return them parsed
    let icd10Codes: string[] = [];
    try {
        icd10Codes = JSON.parse(data[0].icd10Codes || '[]');
    } catch {
        icd10Codes = [];
    }
    let icd9Codes: string[] = [];
    try {
        icd9Codes = JSON.parse(data[0].icd9Codes || '[]');
    } catch {
        icd9Codes = [];
    }

    res.json({ ...data[0], icd10Codes, icd9Codes });
}));

// POST EMR SOAP for a visit
router.post('/soap', requireAuth, requireRole(...ROLE_GROUPS.clinical), validate(saveSoapSchema), asyncHandler(async (req, res) => {
    // Serialize the ICD-10 / ICD-9 code arrays into the text columns
    const payload = {
        ...req.body,
        icd10Codes: JSON.stringify(req.body.icd10Codes || []),
        icd9Codes: JSON.stringify(req.body.icd9Codes || []),
    };

    // Upsert logic (if exists, update, else insert)
    const existing = await db.select().from(emrSoap).where(eq(emrSoap.visitId, req.body.visitId));
    if (existing.length > 0) {
        const updated = await db.update(emrSoap)
            .set({ ...payload, updatedAt: new Date() })
            .where(eq(emrSoap.visitId, req.body.visitId))
            .returning();
        res.json(updated[0]);
    } else {
        const soap = await db.insert(emrSoap).values({
            id: `SOAP-${Date.now()}`,
            ...payload
        }).returning();
        res.status(201).json(soap[0]);
    }
}));

// ==========================================
// VITAL SIGNS + MEWS EARLY WARNING SYSTEM
// ==========================================

// GET all vital signs for a visit (timeline for trending chart)
router.get('/vital-signs/:visitId', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const rows = await db.select({
        id: vitalSigns.id,
        visitId: vitalSigns.visitId,
        recordedBy: vitalSigns.recordedBy,
        recorderName: users.name,
        sistolik: vitalSigns.sistolik,
        diastolik: vitalSigns.diastolik,
        nadi: vitalSigns.nadi,
        suhu: vitalSigns.suhu,
        pernapasan: vitalSigns.pernapasan,
        spo2: vitalSigns.spo2,
        beratBadan: vitalSigns.beratBadan,
        tinggiBadan: vitalSigns.tinggiBadan,
        gcs: vitalSigns.gcs,
        mewsScore: vitalSigns.mewsScore,
        catatan: vitalSigns.catatan,
        penyelenggara: vitalSigns.penyelenggara,
        createdAt: vitalSigns.createdAt,
    })
        .from(vitalSigns)
        .leftJoin(users, eq(vitalSigns.recordedBy, users.id))
        .where(eq(vitalSigns.visitId, req.params.visitId))
        .orderBy(vitalSigns.createdAt);

    // Attach computed MEWS level/action for client convenience
    const enriched = rows.map(r => ({
        ...r,
        mews: mewsActionFor(r.mewsScore ?? 0),
    }));

    res.json(enriched);
}));

// POST new vital signs record — auto-computes MEWS and creates a critical
// notification for the responsible doctor when score >= 3 (deterioration).
router.post('/vital-signs', requireAuth, requireRole(...ROLE_GROUPS.clinical), validate(saveVitalSignsSchema), asyncHandler(async (req, res) => {
    const { recordedBy, visitId, ...rest } = req.body;

    const mews = computeMews({
        sistolik: rest.sistolik,
        diastolik: rest.diastolik,
        nadi: rest.nadi,
        suhu: rest.suhu,
        pernapasan: rest.pernapasan,
        spo2: rest.spo2,
        gcs: rest.gcs,
    });

    const inserted = await db.insert(vitalSigns).values({
        id: `VS-${Date.now()}-${nanoid(6)}`,
        visitId,
        recordedBy,
        ...rest,
        mewsScore: mews.score,
    }).returning();

    // Escalation: auto-create notification for the treating doctor when
    // deterioration is detected (MEWS >= 3). This is the life-saving hook.
    if (mews.score >= 3) {
        const visit = await db.select({
            dokterId: visits.dokterId,
            patientName: patients.nama,
            rm: patients.rm,
        })
            .from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .where(eq(visits.id, visitId))
            .limit(1);

        if (visit.length && visit[0].dokterId) {
            await db.insert(notifications).values({
                userId: visit[0].dokterId,
                title: `⚠️ MEWS ${mews.score} — Periksa Pasien`,
                message: `Pasien ${visit[0].patientName} (RM: ${visit[0].rm}) menunjukkan tanda deteriorasi. ${mews.action}`,
                type: mews.level === 'danger' ? 'error' : 'warning',
                linkUrl: `/rawat-jalan`,
            });
        }
    }

    res.status(201).json({ ...inserted[0], mews });
}));

// ==========================================
// CPPT — Catatan Perkembangan Pasien Terintegrasi
// ==========================================

// GET all progress notes for a visit (longitudinal timeline)
router.get('/progress-notes/:visitId', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const rows = await db.select({
        id: emrProgressNotes.id,
        visitId: emrProgressNotes.visitId,
        authorId: emrProgressNotes.authorId,
        authorName: users.name,
        authorRole: emrProgressNotes.authorRole,
        subjektif: emrProgressNotes.subjektif,
        objektif: emrProgressNotes.objektif,
        asesmen: emrProgressNotes.asesmen,
        planning: emrProgressNotes.planning,
        icd10Codes: emrProgressNotes.icd10Codes,
        icd9Codes: emrProgressNotes.icd9Codes,
        createdAt: emrProgressNotes.createdAt,
        updatedAt: emrProgressNotes.updatedAt,
    })
        .from(emrProgressNotes)
        .leftJoin(users, eq(emrProgressNotes.authorId, users.id))
        .where(and(eq(emrProgressNotes.visitId, req.params.visitId), /* exclude soft-deleted */ eq(emrProgressNotes.deletedAt, null as unknown as Date)))
        .orderBy(emrProgressNotes.createdAt);

    // Parse the ICD code JSON arrays before returning
    const parsed = rows.map(r => {
        let icd10: string[] = [];
        let icd9: string[] = [];
        try { icd10 = JSON.parse(r.icd10Codes || '[]'); } catch { /* keep empty */ }
        try { icd9 = JSON.parse(r.icd9Codes || '[]'); } catch { /* keep empty */ }
        return { ...r, icd10Codes: icd10, icd9Codes: icd9 };
    });

    res.json(parsed);
}));

// POST new progress note (CPPT entry)
router.post('/progress-notes', requireAuth, requireRole(...ROLE_GROUPS.clinical), validate(saveProgressNoteSchema), asyncHandler(async (req, res) => {
    const payload = {
        ...req.body,
        icd10Codes: JSON.stringify(req.body.icd10Codes || []),
        icd9Codes: JSON.stringify(req.body.icd9Codes || []),
    };

    const inserted = await db.insert(emrProgressNotes).values({
        id: `CPPT-${Date.now()}-${nanoid(6)}`,
        ...payload,
    }).returning();

    res.status(201).json(inserted[0]);
}));

// ==========================================
// ALLERGY ALERT — GET patient allergy banner data
// Returns structured allergy info for the safety banner shown at the top of
// every clinical screen. Centralized so every module consumes the same shape.
// ==========================================
router.get('/allergy/:patientId', requireAuth, asyncHandler(async (req, res) => {
    const rows = await db.select({
        id: patients.id,
        rm: patients.rm,
        nama: patients.nama,
        alergi: patients.alergi,
        goldar: patients.goldar,
    })
        .from(patients)
        .where(eq(patients.id, req.params.patientId))
        .limit(1);

    if (!rows.length) {
        res.status(404).json({ error: 'Pasien tidak ditemukan' });
        return;
    }

    const p = rows[0];
    const hasAllergy = !!(p.alergi && p.alergi.trim() && p.alergi.trim().toLowerCase() !== 'tidak ada');

    res.json({
        ...p,
        hasAllergy,
        alergiList: hasAllergy
            ? p.alergi!.split(/[,;]/).map(s => s.trim()).filter(Boolean)
            : [],
    });
}));

// ==========================================
// FHIR R4 EXPORT — Build a FHIR Bundle for a visit (SATUSEHAT ready)
// ==========================================
router.get('/fhir/:visitId', requireAuth, asyncHandler(async (req, res) => {
    const { buildVisitFhirBundle } = await import('../../utils/fhir');
    const bundle = await buildVisitFhirBundle(req.params.visitId);
    res.json(bundle);
}));

// ==========================================
// CDSS — CLINICAL DECISION SUPPORT SYSTEM
// ==========================================

// POST /clinical/cdss/icd-suggest — auto-suggest ICD-10 from SOAP text
router.post('/cdss/icd-suggest', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text || text.trim().length < 3) {
        res.json({ suggestions: [] });
        return;
    }
    const { suggestIcd10 } = await import('../../utils/cdss');
    const suggestions = suggestIcd10(text);
    res.json({ suggestions });
}));

// POST /clinical/cdss/ddi-check — check drug-drug interactions
router.post('/cdss/ddi-check', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const { medicineNames } = req.body as { medicineNames?: string[] };
    if (!Array.isArray(medicineNames) || medicineNames.length < 2) {
        res.json({ alerts: [] });
        return;
    }
    const { checkDrugInteractions } = await import('../../utils/cdss');
    const alerts = checkDrugInteractions(medicineNames);
    res.json({ alerts });
}));

// POST E-Resep / Prescription
router.post('/prescription', requireAuth, requireRole(...ROLE_GROUPS.clinical), validate(createPrescriptionSchema), asyncHandler(async (req, res) => {
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
}));

// ==========================================
// E-RECIPE KEMENKES — Sign prescription & generate QR payload
// ==========================================

// POST /clinical/prescription/:id/sign-e-recipe
// Generates the e-Recipe QR payload (Kemenkes format) for a prescription.
router.post('/prescription/:id/sign-e-recipe', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ERECIPE_SECRET = process.env.ERECIPE_SECRET || 'simrs-erecipe-dev-key-change-in-prod';

    // Load prescription with joined doctor, patient, visit, and items
    const prescRows = await db.select({
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

    if (!prescRows.length) {
        return res.status(404).json({ error: 'Resep tidak ditemukan' });
    }
    const presc = prescRows[0];

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

    if (!visitRows.length) {
        return res.status(404).json({ error: 'Kunjungan tidak ditemukan' });
    }
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
        .leftJoin(medicines, eq(prescriptionItems.obatId, String(medicines.id)))
        .where(eq(prescriptionItems.prescriptionId, id));

    const { generateERecipe } = await import('../../utils/erecipe');
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
    }, ERECIPE_SECRET);

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

// POST Orders (Lab / Radiology)
router.post('/orders/:type', requireAuth, requireRole(...ROLE_GROUPS.clinical), validate(createOrderSchema), asyncHandler(async (req, res) => {
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
}));

// ==========================================
// RAWAT INAP (ADMISI)
// ==========================================

// GET Rawat Inap Patients
router.get('/rawat-inap', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
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
}));

// POST Rawat Inap Admisi
router.post('/rawat-inap/admisi', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
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
}));

// PUT Update Rawat Inap Status
router.put('/rawat-inap/:id/status', requireAuth, requireRole(...ROLE_GROUPS.clinical), asyncHandler(async (req, res) => {
    await db.update(rawatInapAdmisi)
        .set({
            status: req.body.status,
            waktuKeluar: req.body.status === 'pulang' ? new Date() : null
        })
        .where(eq(rawatInapAdmisi.id, req.params.id));
    res.json({ success: true });
}));

export const clinicalRouter = router;
