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
    // Patient safety fields (MEWS + allergy banner)
    mewsScore?: number;
    mews?: { level: 'normal' | 'watch' | 'warn' | 'danger'; action: string };
    alergi?: string | null;
    hasAllergy?: boolean;
    patientId?: string;
}

export interface IgdAdmisiData {
    pasien: string;
    triase: 'merah' | 'kuning' | 'hijau' | 'hitam';
    diagnosaAwal: string;
    dokter: string;
    // Structured vital signs for triage + auto MEWS
    sistolik?: number;
    diastolik?: number;
    nadi?: number;
    suhu?: number;
    pernapasan?: number;
    spo2?: number;
    kesadaran?: string;
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
            visitId: d.visitId,
            mewsScore: d.mewsScore,
            mews: d.mews,
            alergi: d.alergi,
            hasAllergy: d.hasAllergy,
            patientId: d.patientId,
        }));
    },
    createAdmisi: async (data: IgdAdmisiData) => {
        const res = await api.post('/igd/admisi', data);
        return res.data;
    },
    updateStatusTindakan: async (visitId: string, status: string) => {
        const res = await api.put(`/igd/tindakan/${visitId}`, { status });
        return res.data;
    }
};
