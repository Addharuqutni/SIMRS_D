import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useList, useMutate } from '../lib/query';
import { scheduleApi, type AntreanItem, type JadwalInput } from '../lib/api/schedule';
import { useQueueSocket } from './useWebSocket';

export const useSchedules = () => useList('schedules-doctors', scheduleApi.getSchedules);

/** Today's queues per poli, refreshed instantly on server queue events. */
export const useDisplayQueues = () => {
    const qc = useQueryClient();
    const { lastEvent, connected } = useQueueSocket();
    useEffect(() => {
        if (lastEvent?.type === 'queue:update' || lastEvent?.type === 'queue:called') {
            qc.invalidateQueries({ queryKey: ['queues-display'] });
        }
    }, [lastEvent, qc]);
    // Live events refresh the cache; polling is only the fallback while the socket is down.
    const query = useQuery<AntreanItem[]>({
        queryKey: ['queues-display'],
        queryFn: scheduleApi.getDisplayQueues,
        refetchInterval: connected ? false : 5000,
    });
    return { ...query, lastEvent, connected };
};

export const useNextQueue = () => useMutate(scheduleApi.nextQueue, 'queues-display');
export const useSkipQueue = () => useMutate(scheduleApi.skipQueue, 'queues-display');
export const useRecallQueue = () => useMutate(scheduleApi.recallQueue);
export const useCreateSchedule = () => useMutate(scheduleApi.createSchedule, 'schedules-doctors');
export const useUpdateSchedule = () =>
    useMutate(({ id, data }: { id: number; data: JadwalInput }) => scheduleApi.updateSchedule(id, data), 'schedules-doctors');
export const useDeleteSchedule = () => useMutate(scheduleApi.deleteSchedule, 'schedules-doctors');
