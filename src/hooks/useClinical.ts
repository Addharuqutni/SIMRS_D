import { useMutation, useQuery } from '@tanstack/react-query';
import { useList, useDetail, useMutate } from '../lib/query';
import { useListQuery } from '../lib/list-query';
import { clinicalApi } from '../lib/api/clinical';
import type { Icd10Code, Icd9Code, VitalSignsRecord, ProgressNote } from '../lib/api/clinical';
import type { CreateOrderInput } from '../lib/api/penunjang';

// RAWAT JALAN
export const useRawatJalanList = () => useListQuery('rawat-jalan', clinicalApi.listRawatJalan);
export const useKunjungan = (id: string) => useDetail('rawat-jalan', id, () => clinicalApi.getKunjungan(id));
export const useRiwayatKunjungan = (id: string) => useDetail('riwayat-kunjungan', id, () => clinicalApi.getRiwayat(id));
export const useUpdateRawatJalanStatus = () =>
    useMutate(({ id, status }: { id: string; status: string }) => clinicalApi.updateRawatJalanStatus(id, status), 'rawat-jalan', 'visits', 'queues-display');

// EMR SOAP
export const useEmrSoap = (visitId: string) => useDetail('emr-soap', visitId, () => clinicalApi.getSoap(visitId));
export const useSaveEmrSoap = () => useMutate(clinicalApi.saveSoap, 'emr-soap');
export const useSignERecipe = () => useMutation({ mutationFn: (prescriptionId: string) => clinicalApi.signERecipe(prescriptionId) });
/** EMR order entry — invalidates both unit worklists so the order shows up there. */
export const useCreateOrder = () =>
    useMutate(
        (vars: { type: 'lab' | 'radiology'; data: CreateOrderInput }) => clinicalApi.createOrder(vars.type, vars.data),
        'lab-orders', 'rad-orders', 'billings',
    );

// VITAL SIGNS + MEWS — list (timeline) and create
export const useVitalSigns = (visitId: string) =>
    useDetail<VitalSignsRecord[]>('vital-signs', visitId, () => clinicalApi.getVitalSigns(visitId));
export const useSaveVitalSigns = () => useMutate(clinicalApi.saveVitalSigns, 'vital-signs');

// CPPT — progress notes timeline and create
export const useProgressNotes = (visitId: string) =>
    useDetail<ProgressNote[]>('progress-notes', visitId, () => clinicalApi.getProgressNotes(visitId));
export const useSaveProgressNote = () => useMutate(clinicalApi.saveProgressNote, 'progress-notes');

// ALLERGY ALERT — patient safety banner data
export const useAllergyAlert = (patientId?: string) =>
    useQuery({
        queryKey: ['allergy-alert', patientId],
        queryFn: () => clinicalApi.getAllergyAlert(patientId!),
        enabled: !!patientId,
    });

// CDSS — ICD-10 auto-suggest from free text (debounced via query key)
export const useIcdSuggest = (text: string) =>
    useQuery({
        queryKey: ['cdss-icd-suggest', text],
        queryFn: () => clinicalApi.suggestIcd10(text),
        enabled: text.trim().length >= 10,
    });

// CDSS — drug-drug interaction check (mutation — triggered on demand)
export const useCheckDdi = () =>
    useMutation({ mutationFn: (medicineNames: string[]) => clinicalApi.checkDdi(medicineNames) });

// ICD-10 diagnosis search (only fires for queries of 2+ characters)
export const useIcd10Search = (q: string) =>
    useQuery<Icd10Code[]>({
        queryKey: ['icd10', q],
        queryFn: () => clinicalApi.searchIcd10(q),
        enabled: q.trim().length >= 2,
    });

// ICD-9-CM procedure search (only fires for queries of 2+ characters)
export const useIcd9Search = (q: string) =>
    useQuery<Icd9Code[]>({
        queryKey: ['icd9', q],
        queryFn: () => clinicalApi.searchIcd9(q),
        enabled: q.trim().length >= 2,
    });

// Lightweight medicines list for the prescription picker (clinical-scoped endpoint)
export const useClinicalMedicines = () => useList('clinical-medicines', clinicalApi.getClinicalMedicines);

// RAWAT INAP
export const useRawatInapList = () => useListQuery('rawat-inap', clinicalApi.listRawatInap);
export const useCreateRawatInapAdmisi = () => useMutate(clinicalApi.createAdmisiInap, 'rawat-inap', 'visits');
export const useUpdateRawatInapStatus = () =>
    useMutate(({ id, status }: { id: string; status: string }) => clinicalApi.updateRawatInapStatus(id, status), 'rawat-inap', 'billings');
