import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';

export interface BillingItem {
    id: string;
    billingId: string;
    kategori: string;
    namaItem: string;
    harga: number;
    jumlah: number;
    subtotal: number;
    createdAt: string;
}

export interface Billing {
    id: string;
    visitId: string;
    noBilling: string;
    total: number;
    status: 'open' | 'finalized' | 'paid';
    waktuFinalisasi?: string;
    waktuBayar?: string;
    metodePembayaran?: PaymentMethod;
    createdAt: string;
    patientName: string;
    rm: string;
    jaminan: string;
    poli: string;
    items?: BillingItem[];
}

export const PAYMENT_METHODS = [
    { value: 'tunai', label: 'Tunai' },
    { value: 'debit', label: 'Kartu Debit' },
    { value: 'transfer', label: 'Transfer Bank' },
    { value: 'qris', label: 'QRIS' },
    { value: 'bpjs', label: 'BPJS (piutang klaim)' },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export interface Transaction {
    id: string;
    keterangan: string;
    kategori: string;
    jenis: 'pendapatan' | 'piutang' | 'biaya';
    jumlah: number;
    tanggal: string;
    referensi: string | null;
}

export const billingApi = {
    list: (q: PageQuery) => api.get<Page<Billing>>('/billing', { params: q }).then((res) => res.data),
    getBillingDetail: (id: string) => api.get<Billing>(`/billing/${id}`).then((res) => res.data),
    finalizeBilling: (visitId: string) => api.post<Billing>(`/billing/visit/${visitId}/finalize`).then((res) => res.data),
    payBilling: (id: string, metodePembayaran: PaymentMethod) => api.put<Billing>(`/billing/${id}/pay`, { metodePembayaran }).then((res) => res.data),
    getTransactions: () => api.get<Transaction[]>('/billing/transactions').then((res) => res.data),
};
