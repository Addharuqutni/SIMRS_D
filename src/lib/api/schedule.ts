import { api } from '../axios';

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export interface Jadwal {
    id: number;
    doctorId: string;
    dokter: string;
    poli: string;
    dayOfWeek: number;
    hari: string;
    startTime: string;
    endTime: string;
    quota: number;
    aktif: boolean;
}

export interface JadwalInput {
    doctorId: string;
    poliId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    quota: number;
    aktif: boolean;
}

/** Today's queue for one poli, as returned by GET /schedules/queues/display. */
export interface AntreanItem {
    poli: string;
    dokter: string | null;
    sedangDilayani: string | null;
    loket: string | null;
    sisa: number;
    total: number;
}

interface ScheduleRow {
    id: number; doctorId: string; doctorName: string | null; poliId: string; dayOfWeek: number;
    startTime: string; endTime: string; quota: number; isActive: number;
}

const toPayload = (d: JadwalInput) => ({
    doctorId: d.doctorId, poliId: d.poliId, dayOfWeek: d.dayOfWeek,
    startTime: d.startTime, endTime: d.endTime, quota: d.quota, isActive: d.aktif ? 1 : 0,
});

export const scheduleApi = {
    getSchedules: async (): Promise<Jadwal[]> => {
        const res = await api.get<ScheduleRow[]>('/schedules');
        return res.data.map((u) => ({
            id: u.id,
            doctorId: u.doctorId,
            dokter: u.doctorName ?? u.doctorId,
            poli: u.poliId,
            dayOfWeek: u.dayOfWeek,
            hari: HARI[u.dayOfWeek] ?? '-',
            startTime: u.startTime,
            endTime: u.endTime,
            quota: u.quota,
            aktif: u.isActive === 1,
        }));
    },
    createSchedule: (data: JadwalInput) => api.post('/schedules', toPayload(data)).then((res) => res.data),
    updateSchedule: (id: number, data: JadwalInput) => api.put(`/schedules/${id}`, toPayload(data)).then((res) => res.data),
    deleteSchedule: (id: number) => api.delete(`/schedules/${id}`).then((res) => res.data),

    getDisplayQueues: () => api.get<AntreanItem[]>('/schedules/queues/display').then((res) => res.data),
    nextQueue: (poliId: string) => api.post('/schedules/queues/next', { poliId }).then((res) => res.data),
    skipQueue: (poliId: string) => api.post('/schedules/queues/skip', { poliId }).then((res) => res.data),
    recallQueue: (poliId: string) => api.post('/schedules/queues/recall', { poliId }).then((res) => res.data),
};
