import { useList, useDetail, useMutate } from '../lib/query';
import { pharmacyApi } from '../lib/api/pharmacy';

export const usePrescriptions = () => useList('prescriptions', pharmacyApi.getPrescriptions);
export const usePrescriptionDetail = (id: string) => useDetail('prescriptions', id, () => pharmacyApi.getPrescriptionDetail(id));
export const useCreatePrescription = () => useMutate(pharmacyApi.createPrescription, 'prescriptions');
// Completing a prescription reduces stock, so inventory medicines refresh too
export const useUpdatePrescriptionStatus = () =>
    useMutate(
        ({ id, status }: { id: string; status: string }) => pharmacyApi.updatePrescriptionStatus(id, status),
        'prescriptions', 'inventory-medicines'
    );
