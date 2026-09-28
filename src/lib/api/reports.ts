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

export interface MonthlyLedger {
    bulan: string; // YYYY-MM
    pendapatan: number;
    piutang: number;
    biaya: number;
}

export interface RevenueByCategory {
    kategori: string;
    total: number;
}

export const reportsApi = {
    getDashboard: async (): Promise<DashboardData> => {
        const res = await api.get('/reports/dashboard');
        return res.data.data;
    },
    getFinanceMonthly: (months = 6) =>
        api.get<{ data: MonthlyLedger[] }>('/reports/finance/monthly', { params: { months } }).then((res) => res.data.data),
    getRevenueByCategory: () =>
        api.get<{ data: RevenueByCategory[] }>('/reports/finance/by-category').then((res) => res.data.data),
};
