import { api } from '../axios';

export interface RawatJalanPatient {
    id: string;
    nama: string;
    rm: string;
    poli: string;
    dokter: string;
    dokterId: string;
    status: 'menunggu' | 'pemeriksaan' | 'selesai';
    waktu: string;
}

export interface EmrSoap {
    id?: string;
    visitId: string;
    dokterId: string;
    subjektif: string;
    objektif: string;
    asesmen: string;
    planning: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface RawatInapPatient {
    id: string;
    visitId: string;
    rm: string;
    pasien: string;
    ruangan: string;
    kelas: string;
    masuk: string;
    dpjp: string;
    status: 'dirawat' | 'kritis' | 'rencana_pulang' | 'pulang';
}

export const clinicalApi = {
    // Rawat Jalan
    getRawatJalan: async (): Promise<RawatJalanPatient[]> => {
        const res = await api.get('/clinical/rawat-jalan');
        return res.data;
    },
    updateRawatJalanStatus: async (id: string, status: string) => {
        const res = await api.put(`/clinical/rawat-jalan/${id}/status`, { status });
        return res.data;
    },

    // EMR SOAP
    getSoap: async (visitId: string): Promise<EmrSoap | null> => {
        const res = await api.get(`/clinical/soap/${visitId}`);
        return res.data;
    },
    saveSoap: async (data: Partial<EmrSoap>) => {
        const res = await api.post('/clinical/soap', data);
        return res.data;
    },
    createPrescription: async (data: { visitId: string; dokterId: string; items: any[] }) => {
        const res = await api.post('/clinical/prescription', data);
        return res.data;
    },
    createOrder: async (type: 'lab' | 'radiology', data: { visitId: string; dokterId: string; jenisPemeriksaan: string; catatan?: string }) => {
        const res = await api.post(`/clinical/orders/${type}`, data);
        return res.data;
    },

    // Rawat Inap
    getRawatInap: async (): Promise<RawatInapPatient[]> => {
        const res = await api.get('/clinical/rawat-inap');
        return res.data;
    },
    createAdmisiInap: async (data: { pasien: string; ruangan: string; kelas: string; dpjp: string }) => {
        const res = await api.post('/clinical/rawat-inap/admisi', data);
        return res.data;
    },
    updateRawatInapStatus: async (id: string, status: string) => {
        const res = await api.put(`/clinical/rawat-inap/${id}/status`, { status });
        return res.data;
    }
};
