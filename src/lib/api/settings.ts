import axios from 'axios';
import { api } from '../axios';

export interface PublicSettings {
    namaRS: string;
    alamatRS: string;
    jamLayanan: string;
}

export interface HealthStatus {
    status: string;
    message: string;
    timestamp: string;
}

// Health lives outside /api/v1, so it needs a raw axios call (no auth interceptor).
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const settingsApi = {
    getPublicSettings: () => api.get<PublicSettings>('/settings/public').then((res) => res.data),
    getSettings: () => api.get<Record<string, string>>('/settings').then((res) => res.data),
    saveSettings: (settings: Record<string, string>) =>
        api.put<{ success: boolean; saved: number }>('/settings', { settings }).then((res) => res.data),
    getHealth: () => axios.get<HealthStatus>(`${API_BASE}/api/health`).then((res) => res.data),
};
