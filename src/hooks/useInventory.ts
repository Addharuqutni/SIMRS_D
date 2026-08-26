import { useList, useMutate } from '../lib/query';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../lib/api/inventory';

export const useMedicines = () => useList('inventory-medicines', inventoryApi.getMedicines);
export const useCreateMedicine = () => useMutate(inventoryApi.createMedicine, 'inventory-medicines');
export const useUpdateMedicine = () =>
    useMutate(({ kode, data }: { kode: string; data: Partial<any> }) => inventoryApi.updateMedicine(kode, data), 'inventory-medicines');
export const useDeleteMedicine = () => useMutate(inventoryApi.deleteMedicine, 'inventory-medicines');
export const useCreateReception = () => useMutate(inventoryApi.createReception, 'inventory-medicines');
export const useOpname = () => useMutate(inventoryApi.submitOpname, 'inventory-medicines');

// ===== MULTI-WAREHOUSE =====
export const useInventoryLocations = () => useList('inventory-locations', inventoryApi.getLocations);
export const useStockByLocation = (params?: { medicineId?: number; locationId?: number }) =>
    useQuery({
        queryKey: ['stock-by-location', params],
        queryFn: () => inventoryApi.getStockByLocation(params),
    });

export const useTransferStock = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: inventoryApi.transferStock,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['stock-by-location'] });
            qc.invalidateQueries({ queryKey: ['inventory-medicines'] });
        },
    });
};
