import { Router } from 'express';
import { db } from '../../db';
import { sepRecords, visits, patients } from '../../db/schemas/patient';
import { bpjsClaims } from '../../db/schemas/billing';
import { requireAuth } from '../../middleware/auth';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { bpjsService } from './service';
import { generateBpjsSignature } from '../../utils/crypto';
import { logger } from '../../utils/logger';

const router = Router();

// Retrieve configuration from ENV (dummy fallbacks for safety)
const CONS_ID = process.env.BPJS_CONS_ID || '12345';
const SECRET_KEY = process.env.BPJS_SECRET_KEY || 'SECRET_DUMMY_KEY';

// =======================
// SEP VClaim Endpoints
// =======================

// Get all SEPs
router.get('/sep', requireAuth, async (req, res) => {
    try {
        // [VClaim Strategy Demo] Proof of concept: Generating signature headers 
        const { signature, timestamp } = generateBpjsSignature(CONS_ID, SECRET_KEY);
        logger.info(`VClaim Get SEP requested. Generated BPJS Signature: ${signature} at ${timestamp}`);

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
    } catch (error) {
        console.error('Error fetching SEPs:', error);
        res.status(500).json({ error: 'Failed to fetch SEPs' });
    }
});

// Create new SEP
router.post('/sep', requireAuth, async (req, res) => {
    try {
        const { visitId, noKartu, diagnosa, tglSep, ppkRujukan } = req.body;

        // [VClaim Strategy Demo] Proof of concept: Generating signature headers 
        const { signature, timestamp } = generateBpjsSignature(CONS_ID, SECRET_KEY);
        logger.info(`[VClaim] Requesting validation for new SEP to BPJS server with signature ${signature}`);

        // 1. Hit BPJS Service API
        const bpjsResponse = await bpjsService.insertSEP(req.body);
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
    } catch (error) {
        console.error('Error creating SEP:', error);
        res.status(500).json({ error: 'Failed to create SEP' });
    }
});

// Cancel SEP
router.put('/sep/:id/batal', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await db.update(sepRecords).set({ status: 'batal' }).where(eq(sepRecords.id, id)).returning();
        if (!updated.length) return res.status(404).json({ error: 'SEP not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error canceling SEP:', error);
        res.status(500).json({ error: 'Failed to cancel SEP' });
    }
});

// =======================
// Klaim INA-CBG Endpoints
// =======================

// Get all Klaim
router.get('/klaim', requireAuth, async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error fetching klaims:', error);
        res.status(500).json({ error: 'Failed to fetch klaims' });
    }
});

// Update Klaim Status (Kirim, Resolve Dispute, dll)
router.put('/klaim/:id/status', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'pending', 'layak'
        const updated = await db.update(bpjsClaims).set({ status }).where(eq(bpjsClaims.id, id)).returning();
        if (!updated.length) return res.status(404).json({ error: 'Klaim not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating klaim:', error);
        res.status(500).json({ error: 'Failed to update klaim' });
    }
});

export const vclaimRouter = router;
