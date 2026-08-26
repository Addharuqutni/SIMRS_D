import { api } from '../axios';
import type { AxiosResponse } from 'axios';

export interface SepRecord {
    noSep: string;
    pasien: string;
    rm: string;
    noKartu: string;
    diagnosa: string;
    ppkRujukan: string;
    status: 'aktif' | 'terpakai' | 'batal';
    tglSep: string;
}

export interface Klaim {
    noSep: string;
    pasien: string;
    rm: string;
    diagnosa: string;
    inaCbg: string;
    tarifRs: number;
    tarifInaCbg: number;
    status: 'dibentuk' | 'pending' | 'dispute' | 'layak';
    tglKlaim: string;
}

export const bpjsApi = {
    getSeps: () => api.get<SepRecord[]>('/vclaim/sep').then((res: AxiosResponse<SepRecord[]>) => res.data),
    createSep: (data: Partial<SepRecord>) => api.post<SepRecord>('/vclaim/sep', data).then((res: AxiosResponse<SepRecord>) => res.data),
    batalkanSep: (noSep: string) => api.put<SepRecord>(`/vclaim/sep/${noSep}/batal`).then((res: AxiosResponse<SepRecord>) => res.data),

    getKlaims: () => api.get<Klaim[]>('/vclaim/klaim').then((res: AxiosResponse<Klaim[]>) => res.data),
    updateKlaimStatus: (noSep: string, status: string) => api.put<Klaim>(`/vclaim/klaim/${noSep}/status`, { status }).then((res: AxiosResponse<Klaim>) => res.data),
};
