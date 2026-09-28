import { useQuery } from '@tanstack/react-query';
import { useList, useMutate } from '../lib/query';
import { useListQuery } from '../lib/list-query';
import { inventoryApi, type ObatItem } from '../lib/api/inventory';

export const useMedicineList = () => useListQuery('inventory-medicines', inventoryApi.listMedicines);
export const useCreateMedicine = () => useMutate(inventoryApi.createMedicine, 'inventory-medicines');
export const useUpdateMedicine = () =>
    useMutate(({ kode, data }: { kode: string; data: Partial<ObatItem> }) => inventoryApi.updateMedicine(kode, data), 'inventory-medicines');
export const useDeleteMedicine = () => useMutate(inventoryApi.deleteMedicine, 'inventory-medicines');
export const useCreateReception = () => useMutate(inventoryApi.createReception, 'inventory-medicines', 'stock-mutations', 'expiring-batches');
export const useOpname = () => useMutate(inventoryApi.submitOpname, 'inventory-medicines', 'stock-mutations');
export const useStockMutations = (kode: string | null) =>
    useQuery({ queryKey: ['stock-mutations', kode], queryFn: () => inventoryApi.getMutations(kode!), enabled: !!kode });
export const useExpiringBatches = () => useList('expiring-batches', inventoryApi.getExpiringBatches);
export const useDisposeBatch = () =>
    useMutate(({ id, jenis, catatan }: { id: number; jenis: 'MUSNAH' | 'RETUR'; catatan?: string }) =>
        inventoryApi.disposeBatch(id, jenis, catatan), 'expiring-batches', 'inventory-medicines', 'stock-mutations');
