import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labApi, radApi } from '../lib/api/penunjang';
import type { LabOrder, RadiologyOrder } from '../lib/api/penunjang';

// === LABORATORY HOOKS ===

export const useLabOrders = () => {
    return useQuery({
        queryKey: ['lab-orders'],
        queryFn: labApi.getOrders
    });
};

export const useCreateLabOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: labApi.createOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
        }
    });
};

export const useUpdateLabOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<LabOrder> }) => labApi.updateOrder(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
        }
    });
};

export const useDeleteLabOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: labApi.deleteOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
        }
    });
};


// === RADIOLOGY HOOKS ===

export const useRadiologyOrders = () => {
    return useQuery({
        queryKey: ['rad-orders'],
        queryFn: radApi.getOrders
    });
};

export const useCreateRadiologyOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: radApi.createOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rad-orders'] });
        }
    });
};

export const useUpdateRadiologyOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<RadiologyOrder> }) => radApi.updateOrder(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rad-orders'] });
        }
    });
};

export const useDeleteRadiologyOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: radApi.deleteOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rad-orders'] });
        }
    });
};
