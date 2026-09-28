import { useMutate } from '../lib/query';
import { useListQuery } from '../lib/list-query';
import { igdApi } from '../lib/api/igd';

export const useIgdList = () => useListQuery('igd-daftar', igdApi.list);
export const useCreateAdmisiIgd = () => useMutate(igdApi.createAdmisi, 'igd-daftar', 'visits', 'queues-display');
export const useUpdateIgdStatus = () =>
    useMutate(({ visitId, status }: { visitId: string; status: string }) => igdApi.updateStatus(visitId, status), 'igd-daftar', 'visits');
