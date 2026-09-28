import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';
import type { AdmitInput } from '../../../shared/admission';
import type { CreateOrderInput, Order } from './penunjang';

export interface RawatJalanPatient {
    id: string;
    patientId: string;
    nama: string;
    rm: string;
    poli: string;
    dokter: string | null;
    dokterId: string;
    jaminan: string;
    status: string;
    waktu: string;
    alergi?: string | null;
}

export interface RiwayatKunjungan {
    id: string;
    waktu: string;
    poli: string;
    tipe: string;
    dokter: string | null;
    status: string;
    asesmen: string | null;
    planning: string | null;
    icd10Codes: string[] | null;
}

export interface EmrSoap {
    id?: string;
    visitId: string;
    dokterId: string;
    subjektif: string;
    objektif: string;
    asesmen: string;
    planning: string;
    icd10Codes?: string[];
    icd9Codes?: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface Icd10Code {
    code: string;
    description: string;
    category?: string;
}

export interface Icd9Code {
    code: string;
    description: string;
    category?: string;
}

export interface ClinicalMedicine {
    id: number;
    kodeObat: string;
    nama: string;
    satuan?: string | null;
    stok: number;
}

// ===== VITAL SIGNS + MEWS =====
export interface VitalSignsInput {
    sistolik?: number | null;
    diastolik?: number | null;
    nadi?: number | null;
    suhu?: number | null;
    pernapasan?: number | null;
    spo2?: number | null;
    gcs?: number | null;
    beratBadan?: number | null;
    tinggiBadan?: number | null;
}

export interface VitalSignsRecord extends VitalSignsInput {
    id: string;
    visitId: string;
    recordedBy: string;
    recorderName?: string;
    mewsScore: number | null;
    catatan?: string | null;
    penyelenggara?: string | null;
    createdAt: string;
    mews?: {
        level: 'normal' | 'watch' | 'warn' | 'danger';
        action: string;
    };
}

// ===== CPPT (Progress Notes) =====
export interface ProgressNote {
    id: string;
    visitId: string;
    authorId: string;
    authorName?: string;
    authorRole: 'Dokter' | 'Perawat';
    subjektif?: string;
    objektif?: string;
    asesmen?: string;
    planning?: string;
    icd10Codes?: string[];
    icd9Codes?: string[];
    createdAt: string;
    updatedAt: string;
}

// ===== ALLERGY ALERT =====
export interface AllergyAlert {
    id: string;
    rm: string;
    nama: string;
    alergi?: string | null;
    goldar?: string | null;
    hasAllergy: boolean;
    alergiList: string[];
}

export interface RawatInapPatient {
    id: string;
    visitId: string;
    rm: string;
    pasien: string;
    ruangan: string;
    kelas: string;
    masuk: string;
    keluar: string | null;
    dpjp: string | null;
    jaminan: string;
    status: string;
}

export type RawatInapAdmisiData = Omit<Extract<AdmitInput, { jenis: 'rawat_inap' }>, 'jenis'>;

export const clinicalApi = {
    // Rawat Jalan
    listRawatJalan: (q: PageQuery) => api.get<Page<RawatJalanPatient>>('/clinical/rawat-jalan', { params: q }).then((res) => res.data),
    getKunjungan: (id: string) => api.get<RawatJalanPatient>(`/clinical/rawat-jalan/${id}`).then((res) => res.data),
    getRiwayat: (id: string) => api.get<RiwayatKunjungan[]>(`/clinical/rawat-jalan/${id}/riwayat`).then((res) => res.data),
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
    searchIcd10: async (q: string): Promise<Icd10Code[]> => {
        const res = await api.get('/clinical/icd10', { params: { q } });
        return res.data;
    },
    searchIcd9: async (q: string): Promise<Icd9Code[]> => {
        const res = await api.get('/clinical/icd9', { params: { q } });
        return res.data;
    },
    getClinicalMedicines: async (): Promise<ClinicalMedicine[]> => {
        const res = await api.get('/clinical/medicines');
        return res.data;
    },
    signERecipe: async (prescriptionId: string): Promise<{ success: boolean; eRecipeCode: string; qrString: string; payload: unknown }> => {
        const res = await api.post(`/clinical/prescription/${prescriptionId}/sign-e-recipe`);
        return res.data;
    },
    /** EMR order entry — same server operation as the unit worklists. */
    createOrder: async (type: 'lab' | 'radiology', data: CreateOrderInput): Promise<Order> => {
        const res = await api.post<Order>(`/clinical/orders/${type}`, data);
        return res.data;
    },

    // Vital Signs (timeline + create with auto-MEWS)
    getVitalSigns: async (visitId: string): Promise<VitalSignsRecord[]> => {
        const res = await api.get(`/clinical/vital-signs/${visitId}`);
        return res.data;
    },
    saveVitalSigns: async (data: { visitId: string; recordedBy: string } & VitalSignsInput & { catatan?: string; penyelenggara?: string }) => {
        const res = await api.post('/clinical/vital-signs', data);
        return res.data;
    },

    // CPPT — Catatan Perkembangan Pasien Terintegrasi
    getProgressNotes: async (visitId: string): Promise<ProgressNote[]> => {
        const res = await api.get(`/clinical/progress-notes/${visitId}`);
        return res.data;
    },
    saveProgressNote: async (data: Omit<ProgressNote, 'id' | 'createdAt' | 'updatedAt' | 'authorName'>) => {
        const res = await api.post('/clinical/progress-notes', data);
        return res.data;
    },

    // Allergy alert banner data
    getAllergyAlert: async (patientId: string): Promise<AllergyAlert> => {
        const res = await api.get(`/clinical/allergy/${patientId}`);
        return res.data;
    },

    // FHIR R4 export — build a Bundle for a visit (SATUSEHAT ready)
    exportFhir: async (visitId: string): Promise<unknown> => {
        const res = await api.get(`/clinical/fhir/${visitId}`);
        return res.data;
    },

    // CDSS — ICD-10 auto-suggest & drug-drug interaction check
    suggestIcd10: async (text: string): Promise<{ suggestions: Array<{ code: string; description: string; matchedKeywords: string[]; confidence: number }> }> => {
        const res = await api.post('/clinical/cdss/icd-suggest', { text });
        return res.data;
    },
    checkDdi: async (medicineNames: string[]): Promise<{ alerts: Array<{ severity: string; drugA: string; drugB: string; description: string; recommendation: string }> }> => {
        const res = await api.post('/clinical/cdss/ddi-check', { medicineNames });
        return res.data;
    },

    // Rawat Inap
    listRawatInap: (q: PageQuery) => api.get<Page<RawatInapPatient>>('/clinical/rawat-inap', { params: q }).then((res) => res.data),
    createAdmisiInap: (data: RawatInapAdmisiData) =>
        api.post<{ visitId: string; rm: string }>('/clinical/rawat-inap/admisi', data).then((res) => res.data),
    updateRawatInapStatus: async (id: string, status: string) => {
        const res = await api.put(`/clinical/rawat-inap/${id}/status`, { status });
        return res.data;
    }
};
