import { api } from '../axios';

export interface IgdPatient {
    rm: string;
    pasien: string;
    triase: 'merah' | 'kuning' | 'hijau' | 'hitam';
    masuk: string;
    diagnosaAwal: string;
    dokter: string;
    status: string;
    visitId: string;
}

export const igdApi = {
    getDaftarIgd: async (): Promise<IgdPatient[]> => {
        const res = await api.get('/igd');
        return res.data.map((d: any) => ({
            rm: d.rm,
            pasien: d.pasien,
            triase: d.triase,
            // Format ISO date to HH:mm string
            masuk: new Date(d.masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            diagnosaAwal: d.diagnosaAwal,
            // Assume dokter name isn't fully joined yet, just use doctorId if missing
            dokter: d.dokter,
            status: d.status,
            visitId: d.visitId
        }));
    },
    createAdmisi: async (data: { pasien: string; triase: string; diagnosaAwal: string; dokter: string }) => {
        const res = await api.post('/igd/admisi', data);
        return res.data;
    },
    updateStatusTindakan: async (visitId: string, status: string) => {
        const res = await api.put(`/igd/tindakan/${visitId}`, { status });
        return res.data;
    }
};
