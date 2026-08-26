import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditLogQuery } from '../lib/api/audit';

export const useAuditLogs = (params: AuditLogQuery) =>
    useQuery({
        queryKey: ['audit-logs', params],
        queryFn: () => auditApi.list(params),
        placeholderData: (prev) => prev, // keep previous page data while loading next
    });
