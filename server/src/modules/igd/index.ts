import { Router } from 'express';
import { db } from '../../db';
import { igdTriase } from '../../db/schemas/clinical';
import { visits, patients } from '../../db/schemas/patient';
import { users } from '../../db/schemas/auth';
import { notifications } from '../../db/schemas/notify';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { computeMews, mewsActionFor } from '../../utils/mews';
import { z } from 'zod';

const router = Router();

// GET all active IGD visits
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const data = await db.select({
        rm: patients.rm,
        pasien: patients.nama,
        triase: igdTriase.triase,
        keluhanUtama: igdTriase.keluhanUtama,
        masuk: visits.waktuDaftar,
        diagnosaAwal: igdTriase.keluhanUtama, // matching frontend expectations initially
        dokter: users.name,
        status: visits.status,
        visitId: visits.id,
        // Include critical MEWS + allergy for safety banner on the list
        mewsScore: igdTriase.mewsScore,
        alergi: patients.alergi,
        patientId: patients.id,
    }).from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .leftJoin(users, eq(visits.dokterId, users.id))
        .leftJoin(igdTriase, eq(visits.id, igdTriase.visitId))
        .where(eq(visits.poliId, 'IGD')) // assuming 'IGD' represents the poliId for emergency room
        .orderBy(desc(visits.waktuDaftar));

    // Attach computed MEWS level/action for client convenience
    const enriched = data.map(r => ({
        ...r,
        mews: mewsActionFor(r.mewsScore ?? 0),
        hasAllergy: !!(r.alergi && r.alergi.trim() && r.alergi.trim().toLowerCase() !== 'tidak ada'),
    }));

    res.json(enriched);
}));

// Zod schema for IGD admission with structured vital signs + MEWS
const admisiSchema = z.object({
    body: z.object({
        pasien: z.string().min(1, 'Nama pasien wajib diisi'),
        triase: z.enum(['merah', 'kuning', 'hijau', 'hitam']),
        diagnosaAwal: z.string().min(1, 'Keluhan utama wajib diisi'),
        dokter: z.string().min(1, 'Dokter wajib dipilih'),
        // Structured vital signs (all optional — triage may be rapid)
        sistolik: z.number().int().min(40).max(300).optional(),
        diastolik: z.number().int().min(20).max(200).optional(),
        nadi: z.number().int().min(20).max(250).optional(),
        suhu: z.number().min(30).max(45).optional(),
        pernapasan: z.number().int().min(5).max(60).optional(),
        spo2: z.number().int().min(50).max(100).optional(),
        kesadaran: z.string().optional(),
    }),
});

// POST new IGD admission (creates patient, visit, and triase with MEWS)
router.post('/admisi', requireAuth, asyncHandler(async (req, res) => {
    const validated = admisiSchema.parse(req);
    const { pasien, triase, diagnosaAwal, dokter, ...vitals } = validated.body;

    let generatedRM = `RM${Math.floor(100000 + Math.random() * 900000)}`;

    const newPatient = await db.insert(patients).values({
        id: `PAT-${Date.now()}`,
        rm: generatedRM,
        nama: pasien,
        gender: 'L', // default placeholder
        alamat: 'Darurat IGD'
    }).returning();

    const newVisit = await db.insert(visits).values({
        id: `VST-${Date.now()}`,
        patientId: newPatient[0].id,
        poliId: 'IGD',
        dokterId: dokter,
        jaminan: 'Umum / Mandiri',
        tipeKunjungan: 'igd',
        status: 'menunggu'
    }).returning();

    // Compute MEWS from the vital signs captured at triage
    const mews = computeMews({
        sistolik: vitals.sistolik,
        diastolik: vitals.diastolik,
        nadi: vitals.nadi,
        suhu: vitals.suhu,
        pernapasan: vitals.pernapasan,
        spo2: vitals.spo2,
    });

    const newTriase = await db.insert(igdTriase).values({
        id: `TRS-${Date.now()}`,
        visitId: newVisit[0].id,
        triase,
        keluhanUtama: diagnosaAwal,
        // Structured numeric vital signs (was varchar — now supports trending)
        sistolik: vitals.sistolik,
        diastolik: vitals.diastolik,
        nadi: vitals.nadi,
        suhu: vitals.suhu,
        pernapasan: vitals.pernapasan,
        spo2: vitals.spo2,
        kesadaran: vitals.kesadaran,
        mewsScore: mews.score,
    }).returning();

    // Escalation: notify treating doctor immediately if MEWS >= 3
    if (mews.score >= 3) {
        await db.insert(notifications).values({
            userId: dokter,
            title: `⚠️ MEWS ${mews.score} — Pasien IGD Kritis`,
            message: `Pasien ${pasien} (Triase ${triase.toUpperCase()}) menunjukkan tanda deteriorasi. ${mews.action}`,
            type: mews.level === 'danger' ? 'error' : 'warning',
            linkUrl: '/igd',
        });
    }

    res.status(201).json({ success: true, visitId: newVisit[0].id, mewsScore: mews.score, mews });
}));

// PUT update status tindakan
router.put('/tindakan/:visitId', requireAuth, asyncHandler(async (req, res) => {
    await db.update(visits)
        .set({ status: req.body.status })
        .where(eq(visits.id, req.params.visitId));
    res.json({ success: true });
}));

export const igdRouter = router;
