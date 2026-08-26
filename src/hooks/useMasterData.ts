import { useQuery } from '@tanstack/react-query';
import { useList, useMutate } from '../lib/query';
import { masterApi } from '../lib/api/master';

export const useMasterUsers = () => useList('master-users', masterApi.getUsers);
export const useDoctors = () => useList('doctors', masterApi.getDoctors);

// q is part of the key so each search term gets its own cache entry
export const useAuditLogs = (q: string) =>
    useQuery({
        queryKey: ['audit-logs', q],
        queryFn: () => masterApi.getAuditLogs(q),
    });

export const useResetPassword = () =>
    useMutate(
        (vars: { id: string; password: string }) => masterApi.resetUserPassword(vars.id, vars.password),
        'master-users'
    );

export const usePurgeAuditLogs = () =>
    useMutate(
        (vars: { days: number }) => masterApi.purgeAuditLogs(vars.days),
        'audit-logs'
    );
