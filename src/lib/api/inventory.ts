export interface ObatItem {
    kode: string;
    nama: string;
    kategori: string;
    bentuk: string;
    stok: number;
    min: number;
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

export interface OpnamePayload {
    items: OpnameItemPayload[];
}

import { api } from '../axios';

export const inventoryApi = {
    getMedicines: async (): Promise<ObatItem[]> => {
        const res = await api.get('/inventory');
        return res.data.map((u: {
            kodeObat: string, nama: string, kategori: string, satuan?: string,
            stok?: number, minStok?: number, hargaJual?: number,
            ed?: string | null, supplier?: string | null,
        }) => ({
            kode: u.kodeObat,
            nama: u.nama,
            kategori: u.kategori,
            bentuk: u.satuan || 'Tablet',
            stok: u.stok ?? 0,
            min: u.minStok || 20,
            ed: u.ed || '',
            harga: u.hargaJual || 0,
            supplier: u.supplier || '-',
        }));
    },
    createMedicine: async (data: Partial<ObatItem>) => {
        const payload = {
            kodeObat: data.kode,
            nama: data.nama,
            kategori: data.kategori,
            satuan: data.bentuk,
            minStok: data.min,
            hargaJual: data.harga
        };
        const res = await api.post('/inventory', payload);
        return res.data;
    },
    updateMedicine: async (kode: string, data: Partial<ObatItem>) => {
        const payload = {
            nama: data.nama,
            kategori: data.kategori,
            satuan: data.bentuk,
            minStok: data.min,
            hargaJual: data.harga
        };
        const res = await api.put(`/inventory/${kode}`, payload);
        return res.data;
    },
    deleteMedicine: async (kode: string) => {
        const res = await api.delete(`/inventory/${kode}`);
        return res.data;
    },
    createReception: async (data: ReceptionPayload) => {
        const res = await api.post('/inventory/reception', data);
        return res.data;
    },
    submitOpname: async (data: OpnamePayload) => {
        const res = await api.post('/inventory/opname', data);
        return res.data;
    },

    // ===== MULTI-WAREHOUSE =====
    getLocations: async () => {
        const res = await api.get('/inventory/locations');
        return res.data;
    },
    createLocation: async (data: { kode: string; nama: string; tipe?: string }) => {
        const res = await api.post('/inventory/locations', data);
        return res.data;
    },
    getStockByLocation: async (params?: { medicineId?: number; locationId?: number }) => {
        const res = await api.get('/inventory/stock-by-location', { params });
        return res.data;
    },
    transferStock: async (data: { medicineId: number; fromLocationId: number; toLocationId: number; qty: number; catatan?: string }) => {
        const res = await api.post('/inventory/transfer', data);
        return res.data;
    },
};
