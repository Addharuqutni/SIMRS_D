import { api } from '../axios';

export interface Patient {
    id: string;
    rm: string;
    nik: string;
    nama: string;
    tempatLahir?: string;
    tanggalLahir?: string;
    gender?: string;
    goldar?: string;
    agama?: string;
    alamat?: string;
    telepon?: string;
    pekerjaan?: string;
    alergi?: string;
}

export interface VisitWithPatient {
    id: string;
    nama: string;
    nik: string;
    jaminan: string;
    poli: string;
    dokter: string;
    status: string;
    waktu: string;
    rm: string;
}

export const patientApi = {
    getPatients: async (): Promise<Patient[]> => {
        const res = await api.get('/patients');
        return res.data;
    },
    createPatient: async (data: Partial<Patient>) => {
        const res = await api.post('/patients', data);
        return res.data;
    },
    updatePatient: async (rm: string, data: Partial<Patient>) => {
        const res = await api.put(`/patients/${rm}`, data);
        return res.data;
    },
    deletePatient: async (rm: string) => {
        const res = await api.delete(`/patients/${rm}`);
        return res.data;
    },
    getVisits: async (): Promise<VisitWithPatient[]> => {
        const res = await api.get('/patients/visits/all');
        return res.data;
    },
    createVisit: async (data: any) => {
        const res = await api.post('/patients/visits', data);
        return res.data;
    },
    deleteVisit: async (id: string) => {
        const res = await api.delete(`/patients/visits/${id}`);
        return res.data;
    }
};
