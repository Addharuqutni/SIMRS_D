export interface User {
    id: string;
    nama: string;
    email: string;
    username: string;
    role: string;
    unit: string;
    lastLogin: string;
    status: 'aktif' | 'nonaktif';
}

import { api } from '../axios';

export const masterApi = {
    getUsers: async (): Promise<User[]> => {
        const res = await api.get('/master/users');
        return res.data.map((u: { id: string, name: string, email: string, role: string, unit?: string, updatedAt: string, status?: 'aktif' | 'nonaktif' }) => ({
            id: u.id,
            nama: u.name,
            email: u.email,
            username: u.email.split('@')[0],
            role: u.role,
            unit: u.unit || '-',
            lastLogin: new Date(u.updatedAt).toISOString().split('T')[0],
            status: u.status || 'aktif'
        }));
    },
    createUser: async (data: Omit<User, 'id' | 'lastLogin'>) => {
        const res = await api.post('/master/users', data);
        return res.data;
    },
    getDoctors: async (): Promise<User[]> => {
        const res = await api.get('/master/doctors');
        return res.data.map((u: any) => ({
            id: u.id,
            nama: u.name,
            email: u.email,
            username: u.email.split('@')[0],
            role: u.role,
            unit: u.unit || '-',
            lastLogin: new Date(u.updatedAt).toISOString().split('T')[0],
            status: u.status || 'aktif'
        }));
    },
    updateUser: async (id: string, data: Partial<User>) => {
        const res = await api.put(`/master/users/${id}`, data);
        return res.data;
    },
    deleteUser: async (id: string) => {
        const res = await api.delete(`/master/users/${id}`);
        return res.data;
    }
};
