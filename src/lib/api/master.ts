import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';

/** User row as the master module returns it (server/src/modules/master/users.ts). */
export interface UserRow {
    id: string;
    name: string;
    email: string;
    role: string;
    unit: string | null;
    status: string;
}

/** UI-facing user shape: `nama`/`username` derived from the server's name/email. */
export interface User {
    id: string;
    nama: string;
    email: string;
    username: string;
    role: string;
    unit: string;
    status: 'aktif' | 'nonaktif';
}

export interface UserInput {
    nama: string;
    email: string;
    role: string;
    unit?: string;
    status: 'aktif' | 'nonaktif';
}

export type UserQuery = PageQuery;

const toUi = (u: UserRow): User => ({
    id: u.id,
    nama: u.name,
    email: u.email,
    username: u.email.split('@')[0],
    role: u.role,
    unit: u.unit || '-',
    status: u.status === 'nonaktif' ? 'nonaktif' : 'aktif',
});

export const masterApi = {
    listUsers: async (q: UserQuery): Promise<Page<User>> => {
        const res = await api.get<Page<UserRow>>('/master/users', { params: q });
        return { ...res.data, data: res.data.data.map(toUi) };
    },
    createUser: async (data: UserInput) => {
        const res = await api.post('/master/users', data);
        return res.data;
    },
    updateUser: async (id: string, data: Partial<UserInput>) => {
        const res = await api.put(`/master/users/${id}`, data);
        return res.data;
    },
    /** Active doctors only (server filters by exact doctor roles). */
    getDoctors: async (): Promise<User[]> => {
        const res = await api.get<UserRow[]>('/master/doctors');
        return res.data.map(toUi);
    },
    resetUserPassword: async (id: string, password: string) => {
        const res = await api.put(`/master/users/${id}/password`, { password });
        return res.data;
    },
};
