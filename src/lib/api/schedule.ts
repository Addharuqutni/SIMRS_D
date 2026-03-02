export interface Jadwal {
    id: number;
    dokter: string;
    spesialis: string;
    poli: string;
    hari: string;
    jam: string;
    kuotaJkn: number;
    kuotaUmum: number;
    status: 'aktif' | 'cuti';
}

export interface AntreanItem {
    poli: string;
    dokter: string;
    sedangDilayani: string;
    sisa: number;
    total: number;
}

import { api } from '../axios';

export const scheduleApi = {
    getSchedules: async (): Promise<Jadwal[]> => {
        const res = await api.get('/schedules');
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return res.data.map((u: any) => ({
            id: u.id,
            dokter: u.doctorName || u.doctorId,
            spesialis: u.poliId,
            poli: u.poliId,
            hari: dayNames[u.dayOfWeek] || 'Senin',
            jam: `${u.startTime} - ${u.endTime}`,
            kuotaJkn: u.quota || 20,
            kuotaUmum: 10,
            status: u.isActive === 1 ? 'aktif' : 'cuti'
        }));
    },
    createSchedule: async (data: any) => {
        const dayMap: Record<string, number> = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
        const payload = {
            doctorId: data.dokter,
            poliId: data.poli || 'Poli Umum',
            dayOfWeek: dayMap[data.hari as string] ?? 1,
            startTime: data.jam ? data.jam.split('-')[0].trim() : '08:00',
            endTime: data.jam ? data.jam.split('-')[1]?.trim() || '12:00' : '12:00',
            quota: data.kuotaJkn || 20,
            isActive: data.status === 'aktif' ? 1 : 0
        };
        const res = await api.post('/schedules', payload);
        return res.data;
    },
    updateSchedule: async (id: number, data: any) => {
        const dayMap: Record<string, number> = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
        const payload = {
            doctorId: data.dokter,
            poliId: data.poli || 'Poli Umum',
            dayOfWeek: dayMap[data.hari as string] ?? 1,
            startTime: data.jam ? data.jam.split('-')[0].trim() : '08:00',
            endTime: data.jam ? data.jam.split('-')[1]?.trim() || '12:00' : '12:00',
            quota: data.kuotaJkn || 20,
            isActive: data.status === 'aktif' ? 1 : 0
        };
        const res = await api.put(`/schedules/${id}`, payload);
        return res.data;
    },
    deleteSchedule: async (id: number) => {
        const res = await api.delete(`/schedules/${id}`);
        return res.data;
    },

    getDisplayQueues: async (): Promise<AntreanItem[]> => {
        const res = await api.get('/schedules/queues/display');
        if (!res.data || res.data.length === 0) {
            return [
                { poli: 'Poli Umum', dokter: 'Dr. Andi, Sp.PD', sedangDilayani: 'A-005', sisa: 12, total: 17 },
                { poli: 'Poli Gigi', dokter: 'Drg. Sarah', sedangDilayani: 'B-012', sisa: 3, total: 15 },
                { poli: 'Poli Bedah', dokter: 'Dr. Budi, Sp.B', sedangDilayani: 'C-002', sisa: 8, total: 10 }
            ];
        }
        return res.data.map((q: { loket?: string; no_antrean: string }) => ({
            poli: q.loket || 'Poli',
            dokter: 'Dokter',
            sedangDilayani: q.no_antrean,
            sisa: 0,
            total: 0
        }));
    },

    nextQueue: async (poliId: string) => {
        return await api.post('/schedules/queues/next', { poliId });
    }
};
