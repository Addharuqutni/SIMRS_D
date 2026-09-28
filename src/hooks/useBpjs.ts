import { useQuery } from '@tanstack/react-query';
import { useDetail, useMutate } from '../lib/query';
import { useListQuery } from '../lib/list-query';
import { bpjsApi, type IssueSepInput } from '../lib/api/bpjs';

/** Server-paginated SEP list for the registration desk. */
export const useSeps = () => useListQuery('seps', bpjsApi.listSeps);

/** The Kunjungan's SEP + Klaim, when the registration page deep-links to /sep?visitId=… */
export const useSepByVisit = (visitId: string) => useDetail('sep-by-visit', visitId, () => bpjsApi.getSepByVisit(visitId));

/** Read-only Kunjungan summary used to prefill the SEP form. */
export const useVisitSummary = (visitId: string) => useDetail('visit-summary', visitId, () => bpjsApi.getVisitSummary(visitId));

/** Card lookup, run once the number is long enough to be a real BPJS card. */
export const usePesertaCheck = (noKartu: string) =>
    useQuery({
        queryKey: ['vclaim-peserta', noKartu],
        queryFn: () => bpjsApi.checkPeserta(noKartu),
        enabled: noKartu.trim().length >= 7,
        retry: false,
    });

// Issuing a SEP also forms its Klaim, so invalidate both lists.
export const useIssueSep = () => useMutate((input: IssueSepInput) => bpjsApi.issueSep(input), 'seps', 'klaims', 'sep-by-visit');
export const useCancelSep = () => useMutate((id: string) => bpjsApi.batalSep(id), 'seps', 'klaims', 'sep-by-visit');

/** Server-paginated Klaim list for billing. */
export const useKlaims = () => useListQuery('klaims', bpjsApi.listKlaims);

export const useUpdateKlaim = () =>
    useMutate(
        ({ id, status }: { id: string; status: 'pending' | 'dispute' | 'layak' }) => bpjsApi.updateKlaimStatus(id, status),
        'klaims',
    );

export const useApplyKlaimHasil = () =>
    useMutate(
        ({ id, inaCbg, tarifInaCbg }: { id: string; inaCbg: string; tarifInaCbg: number }) =>
            bpjsApi.applyKlaimHasil(id, { inaCbg, tarifInaCbg }),
        'klaims',
    );

/** Bridging status shared by SepVClaim and BridgingStatus — same endpoint, same key. */
export const useBridgingStatus = () =>
    useQuery({
        queryKey: ['vclaim-status'],
        queryFn: bpjsApi.getBridgingStatus,
        refetchInterval: 30000,
    });
