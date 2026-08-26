import { useList, useMutate } from '../lib/query';
import { scheduleApi } from '../lib/api/schedule';

export const useSchedules = () => useList('schedules-doctors', scheduleApi.getSchedules);
export const useDisplayQueues = () => useList('queues-display', scheduleApi.getDisplayQueues);
export const useNextQueue = () => useMutate((poliId: string) => scheduleApi.nextQueue(poliId), 'queues-display');
export const useCreateSchedule = () => useMutate(scheduleApi.createSchedule, 'schedules-doctors');
export const useUpdateSchedule = () =>
    useMutate(({ id, data }: { id: number, data: any }) => scheduleApi.updateSchedule(id, data), 'schedules-doctors');
export const useDeleteSchedule = () => useMutate(scheduleApi.deleteSchedule, 'schedules-doctors');
