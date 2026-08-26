import { useList, useMutate } from '../lib/query';
import { igdApi } from '../lib/api/igd';

export const useDaftarIgd = () => useList('igd-daftar', igdApi.getDaftarIgd);
export const useCreateAdmisiIgd = () => useMutate(igdApi.createAdmisi, 'igd-daftar');
export const useUpdateStatusTindakan = () =>
    useMutate(({ visitId, status }: { visitId: string; status: string }) => igdApi.updateStatusTindakan(visitId, status), 'igd-daftar');
