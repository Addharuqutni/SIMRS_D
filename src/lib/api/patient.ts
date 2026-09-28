import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';
import type { AdmitInput, Jaminan } from '../../../shared/admission';

export interface Patient {
    id: string;
    rm: string;
    nik: string | null;
    nama: string;
    tempatLahir?: string | null;
    tanggalLahir?: string | null;
    gender?: string | null;
    goldar?: string | null;
    agama?: string | null;
    alamat?: string | null;
    telepon?: string | null;
    pekerjaan?: string | null;
    alergi?: string | null;
}

export interface VisitWithPatient {
    id: string;
    patientId: string;
    nama: string;
    nik: string | null;
    jaminan: Jaminan;
    poli: string;
    dokter: string | null;
    status: string;
    waktu: string;
    rm: string;
    tipe: 'rawat_jalan' | 'igd' | 'rawat_inap';
    queueCode: string | null;
}

export interface RegistrationResult {
    id: string;
    rm: string;
    nama: string;
    poliId: string;
    jaminan: Jaminan;
    queueCode: string;
    loket: string;
}

export type VisitQuery = PageQuery & { jaminan?: Jaminan };

export const patientApi = {
    searchPatients: (q: string) => api.get<Patient[]>('/patients', { params: { q } }).then((res) => res.data),
    updatePatient: (rm: string, data: Partial<Patient>) => api.put(`/patients/${rm}`, data).then((res) => res.data),
    listVisits: (q: VisitQuery) => api.get<Page<VisitWithPatient>>('/patients/visits/all', { params: q }).then((res) => res.data),
    /** Rawat jalan registration: new or existing patient + Antrean ticket. RM is issued by the server. */
    register: (data: Extract<AdmitInput, { jenis: 'rawat_jalan' }> extends infer T ? Omit<T, 'jenis'> : never) =>
        api.post<RegistrationResult>('/patients/visits', data).then((res) => res.data),
    cancelVisit: (id: string) => api.delete(`/patients/visits/${id}`).then((res) => res.data),
};
