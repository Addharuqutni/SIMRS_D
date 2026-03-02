import { api } from '../axios';

export interface LabOrder {
    id: string;
    visitId: string;
    dokterId: string;
    dokterName?: string;
    patientName?: string;
    rm?: string;
    jenisPemeriksaan: string;
    catatan?: string;
    status: 'menunggu' | 'diproses' | 'selesai' | 'batal';
    hasilUrl?: string;
    hasilTeks?: string;
    waktuOrder: string;
    waktuSelesai?: string;
}

export interface RadiologyOrder {
    id: string;
    visitId: string;
    dokterId: string;
    dokterName?: string;
    patientName?: string;
    rm?: string;
    jenisPemeriksaan: string;
    catatan?: string;
    status: 'menunggu' | 'diproses' | 'selesai' | 'batal';
    hasilDicomUrl?: string;
    expertise?: string;
    waktuOrder: string;
    waktuSelesai?: string;
}

export const labApi = {
    getOrders: async (): Promise<LabOrder[]> => {
        const res = await api.get('/laboratory');
        return res.data;
    },
    createOrder: async (data: any): Promise<LabOrder> => {
        const res = await api.post('/laboratory', data);
        return res.data;
    },
    updateOrder: async (id: string, data: any) => {
        const res = await api.put(`/laboratory/${id}`, data);
        return res.data;
    },
    deleteOrder: async (id: string) => {
        const res = await api.delete(`/laboratory/${id}`);
        return res.data;
    }
};

export const radApi = {
    getOrders: async (): Promise<RadiologyOrder[]> => {
        const res = await api.get('/radiology');
        return res.data;
    },
    createOrder: async (data: any): Promise<RadiologyOrder> => {
        const res = await api.post('/radiology', data);
        return res.data;
    },
    updateOrder: async (id: string, data: any) => {
        const res = await api.put(`/radiology/${id}`, data);
        return res.data;
    },
    deleteOrder: async (id: string) => {
        const res = await api.delete(`/radiology/${id}`);
        return res.data;
    }
};
