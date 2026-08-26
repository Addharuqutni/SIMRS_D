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
    alergi?: string | null;
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
    createPrescription: async (data: { visitId: string; dokterId: string; items: any[] }) => {
        const res = await api.post('/clinical/prescription', data);
        return res.data;
    },
    signERecipe: async (prescriptionId: string): Promise<{ success: boolean; eRecipeCode: string; qrString: string; payload: unknown }> => {
        const res = await api.post(`/clinical/prescription/${prescriptionId}/sign-e-recipe`);
        return res.data;
    },
    createOrder: async (type: 'lab' | 'radiology', data: { visitId: string; dokterId: string; jenisPemeriksaan: string; catatan?: string }) => {
        const res = await api.post(`/clinical/orders/${type}`, data);
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
