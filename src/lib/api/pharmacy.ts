import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';

export interface PrescriptionItem {
    id: string;
    obatId: number;
    namaObat: string | null;
    dosis: string;
    jumlah: number;
    stok: number | null;
    keterangan?: string;
}

export interface Prescription {
    id: string;
    noResep: string;
    visitId: string;
    dokterId: string;
    status: 'baru' | 'proses' | 'selesai';
    waktuResep: string;
    waktuSelesai?: string;
    patientName: string;
    rm: string;
    dokterName: string | null;
    items?: PrescriptionItem[];
}

export interface NewPrescription {
    visitId: string;
    items: { obatId: number; dosis: string; jumlah: number; keterangan?: string }[];
}

export const pharmacyApi = {
    list: (q: PageQuery) => api.get<Page<Prescription>>('/pharmacy/prescriptions', { params: q }).then((res) => res.data),
    getPrescriptionDetail: (id: string) => api.get<Prescription>(`/pharmacy/prescriptions/${id}`).then((res) => res.data),
    /** Written by the signed-in doctor (server binds dokterId to the session). */
    createPrescription: (data: NewPrescription) => api.post<Prescription>('/clinical/prescription', data).then((res) => res.data),
    updatePrescriptionStatus: (id: string, status: 'proses' | 'selesai') =>
        api.put<Prescription>(`/pharmacy/prescriptions/${id}/status`, { status }).then((res) => res.data),
};
