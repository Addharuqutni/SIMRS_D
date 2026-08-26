import { api } from '../axios';

export interface DashboardTrenItem {
    tanggal: string; // YYYY-MM-DD
    jumlah: number;
}

export interface DashboardData {
    kunjunganHariIni: number;
    totalPasien: number;
    resepBaru: number;
    tagihanOpen: { count: number; total: number };
    trenKunjungan: DashboardTrenItem[]; // 7 days ending today
}

export const reportsApi = {
    getDashboard: async (): Promise<DashboardData> => {
        const res = await api.get('/reports/dashboard');
        return res.data.data;
    },
};
