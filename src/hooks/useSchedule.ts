import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '../lib/api/schedule';

export const useSchedules = () => {
    return useQuery({
        queryKey: ['schedules-doctors'],
        queryFn: scheduleApi.getSchedules
    });
};

export const useDisplayQueues = () => {
    return useQuery({
        queryKey: ['queues-display'],
        queryFn: scheduleApi.getDisplayQueues
    });
};

export const useNextQueue = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (poliId: string) => scheduleApi.nextQueue(poliId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['queues-display'] });
        }
    });
};

export const useCreateSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: scheduleApi.createSchedule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules-doctors'] });
        }
    });
};

export const useUpdateSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number, data: any }) => scheduleApi.updateSchedule(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules-doctors'] });
        }
    });
};

export const useDeleteSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: scheduleApi.deleteSchedule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules-doctors'] });
        }
    });
};
