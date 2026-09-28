import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { readPageParams } from '../../utils/pagination';
import {
    applyHasilVerifikasi,
    batalSep,
    cekPeserta,
    getSepByVisit,
    getVisitForSep,
    issueSep,
    listKlaims,
    listSeps,
    markSepTerpakai,
    transitionKlaim,
} from './sep-klaim';
import { vclaimPort } from './adapter';

const router = Router();

const idParam = (name: string) => z.object({ params: z.object({ [name]: z.string().trim().min(1).max(64) }) });

const cekPesertaSchema = z.object({
    params: z.object({ noKartu: z.string().trim().min(1).max(30) }),
    query: z.object({ tgl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional() }),
});

const issueSepSchema = z.object({
    body: z.object({
        visitId: z.string().trim().min(1).max(64),
        noKartu: z.string().trim().min(1).max(30),
        diagnosa: z.string().trim().min(1).max(200),
        ppkRujukan: z.string().trim().max(200).optional().nullable(),
    }).strict(),
});

const klaimStatusSchema = z.object({
    params: z.object({ id: z.string().trim().min(1).max(64) }),
    body: z.object({ status: z.enum(['pending', 'dispute', 'layak']) }).strict(),
});

const klaimHasilSchema = z.object({
    params: z.object({ id: z.string().trim().min(1).max(64) }),
    body: z.object({
        inaCbg: z.string().trim().min(1).max(30),
        tarifInaCbg: z.number().int().nonnegative(),
    }).strict(),
});

// ─── Bridging status ────────────────────────────────────────────────────────

// GET /api/v1/vclaim/status — bridge mode + which credentials are present.
// Readable by Superadmin and by Pendaftaran (the /sep page needs it to warn when
// SEP issuance is impossible); exposes only booleans, never credential values.
router.get('/status', requireAuth, requireRole('admin', 'registration'), asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await vclaimPort.status() });
}));

// ─── Peserta ────────────────────────────────────────────────────────────────

// GET /api/v1/vclaim/peserta/:noKartu?tgl=YYYY-MM-DD — BPJS card lookup.
router.get('/peserta/:noKartu', requireAuth, requireRole('registration'), validate(cekPesertaSchema), asyncHandler(async (req, res) => {
    res.json(await cekPeserta(vclaimPort, req.params.noKartu, req.query.tgl as string | undefined));
}));

// ─── SEP ────────────────────────────────────────────────────────────────────

// GET /api/v1/vclaim/sep — paginated SEP list (search pasien / RM / noSEP).
router.get('/sep', requireAuth, requireRole('registration'), asyncHandler(async (req, res) => {
    res.json(await listSeps(db, readPageParams(req)));
}));

// GET /api/v1/vclaim/sep/visit/:visitId — the Kunjungan's SEP + Klaim, if any.
router.get('/sep/visit/:visitId', requireAuth, requireRole('registration'), validate(idParam('visitId')), asyncHandler(async (req, res) => {
    res.json(await getSepByVisit(db, req.params.visitId));
}));

// GET /api/v1/vclaim/visit/:visitId — read-only Kunjungan summary for the SEP form.
router.get('/visit/:visitId', requireAuth, requireRole('registration'), validate(idParam('visitId')), asyncHandler(async (req, res) => {
    res.json(await getVisitForSep(db, req.params.visitId));
}));

// POST /api/v1/vclaim/sep — issue a SEP (peserta must be AKTIF, one aktif SEP per Kunjungan).
router.post('/sep', requireAuth, requireRole('registration'), validate(issueSepSchema), asyncHandler(async (req, res) => {
    res.status(201).json(await issueSep(db, vclaimPort, req.body));
}));

// PUT /api/v1/vclaim/sep/:id/batal — cancel an aktif SEP through the port.
router.put('/sep/:id/batal', requireAuth, requireRole('registration'), validate(idParam('id')), asyncHandler(async (req, res) => {
    res.json(await batalSep(db, vclaimPort, req.params.id));
}));

// PUT /api/v1/vclaim/sep/:id/terpakai — SEP consumed by a settled Kunjungan.
router.put('/sep/:id/terpakai', requireAuth, requireRole('registration'), validate(idParam('id')), asyncHandler(async (req, res) => {
    res.json(await markSepTerpakai(db, req.params.id));
}));

// ─── Klaim INA-CBG ──────────────────────────────────────────────────────────

// GET /api/v1/vclaim/klaim — paginated Klaim list (search pasien / RM / noSEP).
router.get('/klaim', requireAuth, requireRole('billing'), asyncHandler(async (req, res) => {
    res.json(await listKlaims(db, readPageParams(req)));
}));

// PUT /api/v1/vclaim/klaim/:id/status — lifecycle move (dibentuk → pending → layak | dispute → pending).
router.put('/klaim/:id/status', requireAuth, requireRole('billing'), validate(klaimStatusSchema), asyncHandler(async (req, res) => {
    res.json(await transitionKlaim(db, req.params.id, req.body.status));
}));

// PUT /api/v1/vclaim/klaim/:id/hasil — record BPJS grouping and mark the claim 'layak'.
router.put('/klaim/:id/hasil', requireAuth, requireRole('billing'), validate(klaimHasilSchema), asyncHandler(async (req, res) => {
    res.json(await applyHasilVerifikasi(db, req.params.id, req.body));
}));

export const vclaimRouter = router;
