import { useList, useMutate } from '../lib/query';
import { labApi, radApi } from '../lib/api/penunjang';
import type { LabOrder, RadiologyOrder } from '../lib/api/penunjang';

// LABORATORY
export const useLabOrders = () => useList('lab-orders', labApi.getOrders);
export const useCreateLabOrder = () => useMutate(labApi.createOrder, 'lab-orders');
export const useUpdateLabOrder = () =>
    useMutate(({ id, data }: { id: string, data: Partial<LabOrder> }) => labApi.updateOrder(id, data), 'lab-orders');
export const useDeleteLabOrder = () => useMutate(labApi.deleteOrder, 'lab-orders');
export const useUploadLabHasil = () =>
    useMutate(({ id, file }: { id: string, file: File }) => labApi.uploadHasil(id, file), 'lab-orders');

// RADIOLOGY
export const useRadiologyOrders = () => useList('rad-orders', radApi.getOrders);
export const useCreateRadiologyOrder = () => useMutate(radApi.createOrder, 'rad-orders');
export const useUpdateRadiologyOrder = () =>
    useMutate(({ id, data }: { id: string, data: Partial<RadiologyOrder> }) => radApi.updateOrder(id, data), 'rad-orders');
export const useDeleteRadiologyOrder = () => useMutate(radApi.deleteOrder, 'rad-orders');
export const useUploadRadHasil = () =>
    useMutate(({ id, file }: { id: string, file: File }) => radApi.uploadHasil(id, file), 'rad-orders');
