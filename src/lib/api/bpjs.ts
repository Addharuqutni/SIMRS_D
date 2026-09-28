import { api } from '../axios';
import type { AxiosResponse } from 'axios';
import type { Page, PageQuery } from '../../../shared/page';

/** Where the SEP number came from: real BPJS web service or the local simulation. */
export type SepSumber = 'bpjs' | 'simulasi';

export interface SepRecord {
    /** sep_records.id — every action addresses a SEP by this, never by noSep. */
    id: string;
    visitId: string;
    noSep: string;
    noKartu: string;
    diagnosa: string;
    tglSep: string;
    ppkRujukan: string | null;
    status: 'aktif' | 'terpakai' | 'batal' | string;
    sumber: SepSumber;
    pasien: string | null;
    rm: string | null;
    jaminan: string | null;
}

export interface Klaim {
    /** bpjs_claims.id — every action addresses a Klaim by this. */
    id: string;
    sepId: string;
    noSep: string | null;
    diagnosa: string | null;
    pasien: string | null;
    rm: string | null;
    inaCbg: string | null;
    tarifRs: number;
    tarifInaCbg: number | null;
    status: 'dibentuk' | 'pending' | 'dispute' | 'layak' | string;
    waktuKlaim: string;
    sumber: SepSumber | null;
}

export interface PesertaCheck {
    noKartu: string;
    nama: string;
    status: string;
    aktif: boolean;
    jenisPeserta?: string;
    kelas?: string;
    tglLahir?: string;
}

export interface BridgingStatus {
    mode: 'real' | 'simulasi' | 'nonaktif';
    configPresent: { consId: boolean; secretKey: boolean; userKey: boolean; baseUrl: string };
    lastCall: { at: string; ok: boolean; latencyMs: number; error?: string } | null;
}

export interface VisitSepSummary {
    id: string;
    patientId: string;
    pasien: string | null;
    rm: string | null;
    jaminan: string;
    poli: string;
    tipeKunjungan: string;
    status: string;
}

export interface IssueSepInput {
    visitId: string;
    noKartu: string;
    diagnosa: string;
    ppkRujukan?: string | null;
}

export const bpjsApi = {
    listSeps: (q: PageQuery) => api.get<Page<SepRecord>>('/vclaim/sep', { params: q }).then((res) => res.data),
    getSepByVisit: (visitId: string) =>
        api.get<{ sep: SepRecord; klaim: Klaim | null }>(`/vclaim/sep/visit/${encodeURIComponent(visitId)}`)
            .then((res: AxiosResponse<{ sep: SepRecord; klaim: Klaim | null }>) => res.data),
    getVisitSummary: (visitId: string) =>
        api.get<VisitSepSummary>(`/vclaim/visit/${encodeURIComponent(visitId)}`).then((res) => res.data),
    checkPeserta: (noKartu: string, tgl?: string) =>
        api.get<PesertaCheck>(`/vclaim/peserta/${encodeURIComponent(noKartu)}`, { params: tgl ? { tgl } : undefined })
            .then((res) => res.data),
    issueSep: (data: IssueSepInput) => api.post<{ sep: SepRecord; klaim: Klaim }>('/vclaim/sep', data).then((res) => res.data),
    batalSep: (id: string) => api.put<SepRecord>(`/vclaim/sep/${encodeURIComponent(id)}/batal`).then((res) => res.data),
    markSepTerpakai: (id: string) => api.put<SepRecord>(`/vclaim/sep/${encodeURIComponent(id)}/terpakai`).then((res) => res.data),

    listKlaims: (q: PageQuery) => api.get<Page<Klaim>>('/vclaim/klaim', { params: q }).then((res) => res.data),
    updateKlaimStatus: (id: string, status: 'pending' | 'dispute' | 'layak') =>
        api.put<Klaim>(`/vclaim/klaim/${encodeURIComponent(id)}/status`, { status }).then((res) => res.data),
    applyKlaimHasil: (id: string, hasil: { inaCbg: string; tarifInaCbg: number }) =>
        api.put<Klaim>(`/vclaim/klaim/${encodeURIComponent(id)}/hasil`, hasil).then((res) => res.data),

    getBridgingStatus: () =>
        api.get<{ success: boolean; data: BridgingStatus }>('/vclaim/status').then((res) => res.data.data),
};
