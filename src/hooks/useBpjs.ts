import { useList, useMutate } from '../lib/query';
import { bpjsApi } from '../lib/api/bpjs';

export const useSeps = () => useList('seps', bpjsApi.getSeps);
// Creating SEP auto-creates Klaim, so invalidate klaims too
export const useCreateSep = () => useMutate(bpjsApi.createSep, 'seps', 'klaims');
export const useCancelSep = () => useMutate(bpjsApi.batalkanSep, 'seps');
export const useKlaims = () => useList('klaims', bpjsApi.getKlaims);
export const useUpdateKlaim = () =>
    useMutate(({ noSep, status }: { noSep: string; status: string }) => bpjsApi.updateKlaimStatus(noSep, status), 'klaims');
