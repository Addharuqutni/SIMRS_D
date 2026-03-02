import { api } from '../axios';
import type { AxiosResponse } from 'axios';

export interface PrescriptionItem {
    id: string;
    obatId: string;
    namaObat: string;
    dosis: string;
    jumlah: number;
    stok: number;
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
    dokterName: string;
    items?: PrescriptionItem[];
}

export const pharmacyApi = {
    getPrescriptions: () => api.get<Prescription[]>('/api/v1/pharmacy/prescriptions').then((res: AxiosResponse<Prescription[]>) => res.data),
    getPrescriptionDetail: (id: string) => api.get<Prescription>(`/api/v1/pharmacy/prescriptions/${id}`).then((res: AxiosResponse<Prescription>) => res.data),
    createPrescription: (data: any) => api.post<Prescription>('/api/v1/pharmacy/prescriptions', data).then((res: AxiosResponse<Prescription>) => res.data),
    updatePrescriptionStatus: (id: string, status: string) => api.put<Prescription>(`/api/v1/pharmacy/prescriptions/${id}/status`, { status }).then((res: AxiosResponse<Prescription>) => res.data),
};
