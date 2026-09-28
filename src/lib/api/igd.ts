import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';
import type { AdmitInput, Triase } from '../../../shared/admission';

export interface IgdPatient {
    rm: string;
    pasien: string;
    triase: Triase | null;
    keluhanUtama: string | null;
    masuk: string;
    dokter: string | null;
    status: string;
    visitId: string;
    mewsScore: number | null;
    mews: { level: 'normal' | 'watch' | 'warn' | 'danger'; action: string };
    alergi: string | null;
    hasAllergy: boolean;
    patientId: string;
}

export type IgdAdmisiData = Omit<Extract<AdmitInput, { jenis: 'igd' }>, 'jenis'>;

export const igdApi = {
    list: (q: PageQuery) => api.get<Page<IgdPatient>>('/igd', { params: q }).then((res) => res.data),
    createAdmisi: (data: IgdAdmisiData) =>
        api.post<{ visitId: string; rm: string; queueCode: string; mewsScore: number }>('/igd/admisi', data).then((res) => res.data),
    updateStatus: (visitId: string, status: string) => api.put(`/igd/tindakan/${visitId}`, { status }).then((res) => res.data),
};
