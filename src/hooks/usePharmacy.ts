import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '../lib/api/pharmacy';

export const usePrescriptions = () => {
    return useQuery({
        queryKey: ['prescriptions'],
        queryFn: pharmacyApi.getPrescriptions,
    });
};

export const usePrescriptionDetail = (id: string) => {
    return useQuery({
        queryKey: ['prescriptions', id],
        queryFn: () => pharmacyApi.getPrescriptionDetail(id),
        enabled: !!id,
    });
};

export const useCreatePrescription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: pharmacyApi.createPrescription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
        },
    });
};

export const useUpdatePrescriptionStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            pharmacyApi.updatePrescriptionStatus(id, status),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
            queryClient.invalidateQueries({ queryKey: ['prescriptions', variables.id] });
            // If completed, stock is reduced, we must also invalidate inventory medicines and mutations
            if (variables.status === 'selesai') {
                queryClient.invalidateQueries({ queryKey: ['medicines'] });
                queryClient.invalidateQueries({ queryKey: ['inventoryMutations'] });
            }
        },
    });
};
