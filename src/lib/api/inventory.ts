import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';

export interface ObatItem {
    id: number;
    kode: string;
    nama: string;
    kategori: string;
    bentuk: string;
    stok: number;
    min: number;
    /** Earliest unexpired batch ED, or '' when no stocked batch. */
    ed: string;
    harga: number;
    supplier: string;
}

export interface ReceptionPayload {
    kodeObat: string;
    noBatch: string;
    noFaktur: string;
    supplier: string;
    qty: number;
    expiredDate: string;
    hargaBeli?: number;
}

export interface OpnameItemPayload {
    kodeObat: string;
    stokFisik: number;
    catatan?: string;
}

export interface StockMutation {
    id: number;
    jenis: 'MASUK' | 'KELUAR' | 'PENYESUAIAN' | 'TRANSFER' | 'MUSNAH' | 'RETUR';
    qty: number;
    keterangan: string | null;
    referensi: string | null;
    createdAt: string;
    noBatch: string | null;
}

export interface ExpiringBatch {
    id: number;
    noBatch: string;
    expiredDate: string;
    qtySisa: number;
    supplier: string | null;
    kodeObat: string;
    nama: string;
    kategori: string | null;
    satuan: string | null;
    expired: boolean;
}

interface MedicineRow {
    id: number; kodeObat: string; nama: string; kategori: string | null; satuan: string | null;
    stok: number; minStok: number; hargaJual: number; ed: string | null; supplier: string | null;
}

const toObat = (u: MedicineRow): ObatItem => ({
    id: u.id,
    kode: u.kodeObat,
    nama: u.nama,
    kategori: u.kategori ?? '-',
    bentuk: u.satuan ?? '-',
    stok: u.stok,
    min: u.minStok,
    ed: u.ed ?? '',
    harga: u.hargaJual,
    supplier: u.supplier ?? '-',
});

const toPayload = (data: Partial<ObatItem>) => ({
    nama: data.nama,
    kategori: data.kategori,
    satuan: data.bentuk,
    minStok: data.min,
    hargaJual: data.harga,
});

export const inventoryApi = {
    listMedicines: async (q: PageQuery): Promise<Page<ObatItem>> => {
        const res = await api.get<Page<MedicineRow>>('/inventory', { params: q });
        return { ...res.data, data: res.data.data.map(toObat) };
    },
    createMedicine: (data: Partial<ObatItem>) =>
        api.post('/inventory', { kodeObat: data.kode, ...toPayload(data) }).then((res) => res.data),
    updateMedicine: (kode: string, data: Partial<ObatItem>) =>
        api.put(`/inventory/${kode}`, toPayload(data)).then((res) => res.data),
    deleteMedicine: (kode: string) => api.delete(`/inventory/${kode}`).then((res) => res.data),
    createReception: (data: ReceptionPayload) => api.post('/inventory/reception', data).then((res) => res.data),
    submitOpname: (items: OpnameItemPayload[]) =>
        api.post<{ processed: unknown[]; notFound: string[] }>('/inventory/opname', { items }).then((res) => res.data),
    getMutations: (kode: string) => api.get<StockMutation[]>(`/inventory/${kode}/mutations`).then((res) => res.data),
    getExpiringBatches: () => api.get<ExpiringBatch[]>('/inventory/batches/expiring').then((res) => res.data),
    disposeBatch: (id: number, jenis: 'MUSNAH' | 'RETUR', catatan?: string) =>
        api.post(`/inventory/batches/${id}/dispose`, { jenis, catatan }).then((res) => res.data),
};
