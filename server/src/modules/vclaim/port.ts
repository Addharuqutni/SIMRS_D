/**
 * VClaim port — the boundary between the SEP/Klaim domain and BPJS VClaim.
 *
 * `sep-klaim.ts` owns every rule about SEP and Klaim; an adapter only talks
 * HTTP (real BPJS) or simulates it (dev/tests). Adapters MUST throw
 * `DomainError` (502/503) on provider failures, so callers never translate
 * transport errors into domain ones.
 *
 * An adapter never returns an empty SEP number and never invents a tariff.
 */

/** Where a SEP number came from. Stored on `sep_records.sumber` and shown in the UI. */
export type SepSumber = 'bpjs' | 'simulasi';

export interface PesertaKartu {
    noKartu: string;
    nama: string;
    /** Status as reported by BPJS, e.g. 'AKTIF', 'NONAKTIF'. */
    status: string;
    /** Jenis peserta (PBI, PBPU, ...) when the provider reports it. */
    jenisPeserta?: string;
    /** Kelas rawat when the provider reports it. */
    kelas?: string;
    /** Tanggal lahir (YYYY-MM-DD) when the provider reports it. */
    tglLahir?: string;
}

export interface SepInsertPayload {
    visitId: string;
    noKartu: string;
    diagnosa: string;
    /** Tanggal pelayanan (YYYY-MM-DD) — the tglSep on the resulting SEP. */
    tglSep: string;
    ppkRujukan?: string | null;
}

export interface SepInserted {
    noSep: string;
    /** Date echoed back by the provider (YYYY-MM-DD). */
    tglSep: string;
}

/** Outcome of the most recent real call through an adapter. */
export interface CallOutcome {
    at: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
}

/** Which credentials are present; booleans only, never the secret values. */
export interface ConfigPresence {
    consId: boolean;
    secretKey: boolean;
    userKey: boolean;
    baseUrl: string;
}

/**
 * `real`    — signed HTTP calls to the BPJS web service;
 * `simulasi`— local deterministic adapter (development / tests);
 * `nonaktif`— production without credentials: every call is refused with 503.
 */
export type BridgingMode = 'real' | 'simulasi' | 'nonaktif';

export interface BridgingStatus {
    mode: BridgingMode;
    configPresent: ConfigPresence;
    lastCall: CallOutcome | null;
}

export interface VClaimPort {
    /** Adapter actually in use — what gets stamped on every new SEP row. */
    readonly sumber: SepSumber;
    cekPeserta(noKartu: string, tgl: string): Promise<PesertaKartu>;
    insertSep(payload: SepInsertPayload): Promise<SepInserted>;
    batalSep(noSep: string): Promise<void>;
    /** Bridging configuration + connectivity, credentials never exposed. */
    status(): Promise<BridgingStatus>;
}
