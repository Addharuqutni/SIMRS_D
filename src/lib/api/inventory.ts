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

import { api } from '../axios';

export const inventoryApi = {
    getMedicines: async (): Promise<ObatItem[]> => {
        const res = await api.get('/inventory');
        return res.data.map((u: { kodeObat: string, nama: string, kategori: string, bentuk?: string, satuan?: string, minStok?: number, hargaJual?: number }) => ({
            kode: u.kodeObat,
            nama: u.nama,
            kategori: u.kategori,
            bentuk: u.bentuk || u.satuan || 'Tablet',
            stok: Math.floor(Math.random() * 200) + 10,
            min: u.minStok || 20,
            ed: '2028-01-01',
            harga: u.hargaJual || 0,
            supplier: 'PBF Default',
        }));
    },
    createMedicine: async (data: Partial<ObatItem>) => {
        const payload = {
            kodeObat: data.kode,
            nama: data.nama,
            kategori: data.kategori,
            bentuk: data.bentuk,
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
            bentuk: data.bentuk,
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
    }
};
