import { api } from '../axios';
import type { AxiosResponse } from 'axios';

export interface BillingItem {
    id: string;
    billingId: string;
    kategori: string;
    namaItem: string;
    harga: number;
    jumlah: number;
    subtotal: number;
}

export interface Billing {
    id: string;
    visitId: string;
    noBilling: string;
    total: number;
    status: 'open' | 'finalized' | 'paid';
    waktuFinalisasi?: string;
    waktuBayar?: string;
    metodePembayaran?: string;
    createdAt: string;
    patientName: string;
    rm: string;
    items?: BillingItem[];
}

export interface Transaction {
    id: string;
    keterangan: string;
    kategori: string;
    jenis: 'pendapatan' | 'piutang' | 'biaya';
    jumlah: number;
    tanggal: string;
}

export const billingApi = {
    getBillings: () => api.get<Billing[]>('/billing').then((res: AxiosResponse<Billing[]>) => res.data),
    getBillingDetail: (id: string) => api.get<Billing>(`/billing/${id}`).then((res: AxiosResponse<Billing>) => res.data),
    finalizeBilling: (visitId: string) => api.post<Billing>(`/billing/visit/${visitId}/finalize`).then((res: AxiosResponse<Billing>) => res.data),
    payBilling: (id: string, metodePembayaran: string) => api.put<Billing>(`/billing/${id}/pay`, { metodePembayaran }).then((res: AxiosResponse<Billing>) => res.data),
    getTransactions: () => api.get<Transaction[]>('/billing/transactions').then((res: AxiosResponse<Transaction[]>) => res.data),
};
