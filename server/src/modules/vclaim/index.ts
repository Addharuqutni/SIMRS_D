import { Router } from 'express';
import { db } from '../../db';
import { sepRecords, visits, patients } from '../../db/schemas/patient';
import { bpjsClaims } from '../../db/schemas/billing';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { ROLE_GROUPS } from '../../utils/roles';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { bpjsService, BpjsApiError, isBpjsConfigured, getBpjsConfigStatus, getBpjsLastCall } from './service';

const router = Router();

// =======================
// Bridging Monitoring
// =======================

// GET /api/v1/vclaim/status — current BPJS bridging mode/config/last-call (admin only).
// Never exposes credential values, only presence booleans.
router.get('/status', requireAuth, requireRole(...ROLE_GROUPS.admin), asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: {
            mode: isBpjsConfigured() ? 'real' : 'mock',
            configPresent: getBpjsConfigStatus(),
            lastCall: getBpjsLastCall(),
        },
    });
}));

// =======================
// SEP VClaim Endpoints
// =======================

// Get all SEPs
router.get('/sep', requireAuth, asyncHandler(async (req, res) => {
    const query = await db.select({
        id: sepRecords.id,
        visitId: sepRecords.visitId,
        noSep: sepRecords.noSep,
        noKartu: sepRecords.noKartu,
        diagnosa: sepRecords.diagnosa,
        tglSep: sepRecords.tglSep,
        ppkRujukan: sepRecords.ppkRujukan,
        status: sepRecords.status,
        pasien: patients.nama,
        rm: patients.rm
    })
        .from(sepRecords)
        .leftJoin(visits, eq(sepRecords.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .orderBy(desc(sepRecords.tglSep));
    res.json(query);
}));

// Create new SEP
router.post('/sep', requireAuth, asyncHandler(async (req, res) => {
    const { visitId, noKartu, diagnosa, tglSep, ppkRujukan } = req.body;

    // 1. Hit BPJS Service API (real call when BPJS env creds are set, mock otherwise)
    let bpjsResponse;
    try {
        bpjsResponse = await bpjsService.insertSEP(req.body);
    } catch (error) {
        if (error instanceof BpjsApiError) {
            return res.status(502).json({ error: `BPJS API: ${error.message}` });
        }
        throw error;
    }
    const generatedNoSep = bpjsResponse.response.sep.noSep;

    // 2. Save to our DB
    const sepId = nanoid();
    const inserted = await db.insert(sepRecords).values({
        id: sepId,
        visitId,
        noSep: generatedNoSep,
        noKartu,
        diagnosa,
        tglSep: bpjsResponse.response.sep.tglSep,
        ppkRujukan,
        status: 'aktif'
    }).returning();

    // 3. Pre-generate a "Dibentuk" Klaim INA-CBG for demo
    const tarifRsMock = Math.floor(Math.random() * 500000) + 100000;
    const tarifInaMock = Math.floor(tarifRsMock * 0.85); // slightly smaller
    await db.insert(bpjsClaims).values({
        id: nanoid(),
        sepId: inserted[0].id,
        inaCbg: 'Q-5-44-0',
        tarifRs: tarifRsMock,
        tarifInaCbg: tarifInaMock,
        status: 'dibentuk'
    });

    res.status(201).json(inserted[0]);
}));

// Cancel SEP
router.put('/sep/:id/batal', requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updated = await db.update(sepRecords).set({ status: 'batal' }).where(eq(sepRecords.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: 'SEP not found' });
    res.json(updated[0]);
}));

// =======================
// Klaim INA-CBG Endpoints
// =======================

// Get all Klaim
router.get('/klaim', requireAuth, asyncHandler(async (req, res) => {
    const query = await db.select({
        id: bpjsClaims.id,
        sepId: bpjsClaims.sepId,
        inaCbg: bpjsClaims.inaCbg,
        tarifRs: bpjsClaims.tarifRs,
        tarifInaCbg: bpjsClaims.tarifInaCbg,
        status: bpjsClaims.status,
        waktuKlaim: bpjsClaims.waktuKlaim,
        noSep: sepRecords.noSep,
        diagnosa: sepRecords.diagnosa,
        pasien: patients.nama,
        rm: patients.rm
    })
        .from(bpjsClaims)
        .leftJoin(sepRecords, eq(bpjsClaims.sepId, sepRecords.id))
        .leftJoin(visits, eq(sepRecords.visitId, visits.id))
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .orderBy(desc(bpjsClaims.waktuKlaim));
    res.json(query);
}));

// Update Klaim Status (Kirim, Resolve Dispute, dll)
router.put('/klaim/:id/status', requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'pending', 'layak'
    const updated = await db.update(bpjsClaims).set({ status }).where(eq(bpjsClaims.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: 'Klaim not found' });
    res.json(updated[0]);
}));

export const vclaimRouter = router;
