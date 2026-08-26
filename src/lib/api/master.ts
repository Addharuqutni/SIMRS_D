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

export interface AuditLog {
    id: number;
    userId: string | null;
    userName: string | null;
    method: string | null;
    path: string | null;
    body: string | null;
    ip: string | null;
    createdAt: string;
}

import { api } from '../axios';

const mapUser = (u: { id: string, name: string, email: string, role: string, unit?: string, updatedAt: string, status?: 'aktif' | 'nonaktif' }): User => ({
    id: u.id,
    nama: u.name,
    email: u.email,
    username: u.email.split('@')[0],
    role: u.role,
    unit: u.unit || '-',
    lastLogin: new Date(u.updatedAt).toISOString().split('T')[0],
    status: u.status || 'aktif'
});

export const masterApi = {
    getUsers: async (): Promise<User[]> => {
        const res = await api.get('/master/users');
        return res.data.map(mapUser);
    },
    createUser: async (data: Omit<User, 'id' | 'lastLogin'>) => {
        const res = await api.post('/master/users', data);
        return res.data;
    },
    getDoctors: async (): Promise<User[]> => {
        const res = await api.get('/master/doctors');
        return res.data.map(mapUser);
    },
    updateUser: async (id: string, data: Partial<User>) => {
        const res = await api.put(`/master/users/${id}`, data);
        return res.data;
    },
    deleteUser: async (id: string) => {
        const res = await api.delete(`/master/users/${id}`);
        return res.data;
    },
    getAuditLogs: async (q = '', limit = 200): Promise<AuditLog[]> => {
        const res = await api.get('/master/audit', { params: { q: q || undefined, limit } });
        return res.data;
    },
    resetUserPassword: async (id: string, password: string) => {
        const res = await api.put(`/master/users/${id}/password`, { password });
        return res.data;
    },
    exportAuditLogs: async (): Promise<Blob> => {
        const res = await api.get('/master/audit/export', { responseType: 'blob' });
        return res.data;
    },
    purgeAuditLogs: async (days = 90): Promise<{ success: boolean; deleted: number }> => {
        const res = await api.delete('/master/audit/purge', { params: { days } });
        return res.data;
    }
};
