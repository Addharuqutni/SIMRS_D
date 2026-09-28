import { useDetail, useMutate } from '../lib/query';
import { useListQuery } from '../lib/list-query';
import { pharmacyApi } from '../lib/api/pharmacy';

export const usePrescriptionList = () => useListQuery('prescriptions', pharmacyApi.list);
export const usePrescriptionDetail = (id: string) => useDetail('prescriptions', id, () => pharmacyApi.getPrescriptionDetail(id));
export const useCreatePrescription = () => useMutate(pharmacyApi.createPrescription, 'prescriptions');
// Dispensing reduces stock and adds billing items, so those caches refresh too
export const useUpdatePrescriptionStatus = () =>
    useMutate(
        ({ id, status }: { id: string; status: 'proses' | 'selesai' }) => pharmacyApi.updatePrescriptionStatus(id, status),
        'prescriptions', 'inventory-medicines', 'billings'
    );
