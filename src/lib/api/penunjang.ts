import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';

/** Penunjang units share one contract; only the URL segment differs. */
export type OrderKind = 'lab' | 'radiologi';

const BASE: Record<OrderKind, string> = { lab: '/laboratory', radiologi: '/radiology' };

export interface Order {
    /** Server-issued `LAB-<nanoid>` / `RAD-<nanoid>`. */
    id: string;
    visitId: string;
    patientName: string | null;
    rm: string | null;
    dokterId: string;
    dokterName: string | null;
    jenisPemeriksaan: string;
    catatan: string | null;
    status: 'menunggu' | 'diproses' | 'selesai' | 'batal' | string;
    /** Uploaded PDF path (`/uploads/...`), null until a hasil is attached. */
    hasilUrl: string | null;
    /** Lab result text (null for radiologi orders). */
    hasilTeks: string | null;
    /** Radiologist's reading (null for lab orders). */
    expertise: string | null;
    waktuOrder: string;
    waktuSelesai: string | null;
}

export interface CreateOrderInput {
    visitId: string;
    dokterId: string;
    jenisPemeriksaan: string;
    catatan?: string | null;
}

export interface CompleteOrderInput {
    hasilTeks?: string | null;
    expertise?: string | null;
    catatan?: string | null;
}

export const penunjangApi = {
    listOrders: (kind: OrderKind, q: PageQuery) =>
        api.get<Page<Order>>(BASE[kind], { params: q }).then((res) => res.data),
    getOrder: (kind: OrderKind, id: string) =>
        api.get<Order>(`${BASE[kind]}/${encodeURIComponent(id)}`).then((res) => res.data),
    createOrder: (kind: OrderKind, data: CreateOrderInput) =>
        api.post<Order>(BASE[kind], data).then((res) => res.data),
    startOrder: (kind: OrderKind, id: string) =>
        api.put<{ id: string; status: string }>(`${BASE[kind]}/${encodeURIComponent(id)}/start`).then((res) => res.data),
    completeOrder: (kind: OrderKind, id: string, data: CompleteOrderInput) =>
        api.put<{ id: string; status: string; waktuSelesai: string }>(`${BASE[kind]}/${encodeURIComponent(id)}/complete`, data)
            .then((res) => res.data),
    cancelOrder: (kind: OrderKind, id: string) =>
        api.put<{ id: string; status: string }>(`${BASE[kind]}/${encodeURIComponent(id)}/cancel`).then((res) => res.data),
    uploadHasil: (kind: OrderKind, id: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        // Content-Type override lets the browser set the multipart boundary.
        return api.post<Order>(`${BASE[kind]}/${encodeURIComponent(id)}/hasil`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then((res) => res.data);
    },
};

/** Uploaded hasil paths are relative to the server origin (e.g. /uploads/x.pdf). */
export const hasilFileUrl = (path?: string | null) => {
    if (!path) return undefined;
    const origin = (api.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '');
    return `${origin}${path}`;
};
