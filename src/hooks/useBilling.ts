import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../lib/api/billing';

export const useBillings = () => {
    return useQuery({
        queryKey: ['billings'],
        queryFn: billingApi.getBillings,
    });
};

export const useBillingDetail = (id: string) => {
    return useQuery({
        queryKey: ['billings', id],
        queryFn: () => billingApi.getBillingDetail(id),
        enabled: !!id,
    });
};

export const useFinalizeBilling = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (visitId: string) => billingApi.finalizeBilling(visitId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billings'] });
        },
    });
};

export const usePayBilling = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, metodePembayaran }: { id: string; metodePembayaran: string }) =>
            billingApi.payBilling(id, metodePembayaran),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['billings'] });
            queryClient.invalidateQueries({ queryKey: ['billings', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
    });
};

export const useTransactions = () => {
    return useQuery({
        queryKey: ['transactions'],
        queryFn: billingApi.getTransactions,
    });
};
