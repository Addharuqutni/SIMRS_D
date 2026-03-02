import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bpjsApi } from '../lib/api/bpjs';

export const useSeps = () => {
    return useQuery({
        queryKey: ['seps'],
        queryFn: bpjsApi.getSeps,
    });
};

export const useCreateSep = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bpjsApi.createSep,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['seps'] });
            // Creating SEP auto-creates Klaim, so invalidate klaims too
            queryClient.invalidateQueries({ queryKey: ['klaims'] });
        },
    });
};

export const useCancelSep = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bpjsApi.batalkanSep,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['seps'] });
        },
    });
};

export const useKlaims = () => {
    return useQuery({
        queryKey: ['klaims'],
        queryFn: bpjsApi.getKlaims,
    });
};

export const useUpdateKlaim = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ noSep, status }: { noSep: string; status: string }) => bpjsApi.updateKlaimStatus(noSep, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['klaims'] });
        },
    });
};
