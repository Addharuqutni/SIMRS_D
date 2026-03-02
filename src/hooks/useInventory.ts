import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../lib/api/inventory';

export const useMedicines = () => {
    return useQuery({
        queryKey: ['inventory-medicines'],
        queryFn: inventoryApi.getMedicines
    });
};

export const useCreateMedicine = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: inventoryApi.createMedicine,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-medicines'] });
        }
    });
};

export const useUpdateMedicine = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ kode, data }: { kode: string; data: Partial<any> }) => inventoryApi.updateMedicine(kode, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-medicines'] });
        }
    });
};

export const useDeleteMedicine = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: inventoryApi.deleteMedicine,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-medicines'] });
        }
    });
};
