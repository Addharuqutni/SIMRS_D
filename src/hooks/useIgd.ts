import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { igdApi } from '../lib/api/igd';

export const useDaftarIgd = () => {
    return useQuery({
        queryKey: ['igd-daftar'],
        queryFn: igdApi.getDaftarIgd
    });
};

export const useCreateAdmisiIgd = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: igdApi.createAdmisi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['igd-daftar'] });
        }
    });
};

export const useUpdateStatusTindakan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ visitId, status }: { visitId: string; status: string }) =>
            igdApi.updateStatusTindakan(visitId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['igd-daftar'] });
        }
    });
};
