import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';

export interface AuditLog {
    id: number;
    userId: string | null;
    userName: string | null;
    method: string | null;
    path: string | null;
    /** HTTP status code recorded when the response finished; null on legacy rows. */
    statusCode: number | null;
    body: string | null;
    ip: string | null;
    createdAt: string;
}

export interface AuditLogQuery extends PageQuery {
    userId?: string;
    method?: string;
    path?: string;
    startDate?: string;
    endDate?: string;
}

const clean = (params: AuditLogQuery) =>
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));

export const auditApi = {
    list: (params: AuditLogQuery) =>
        api.get<Page<AuditLog>>('/audit-logs', { params: clean(params) }).then((res) => res.data),
    exportCsv: (params: AuditLogQuery = {}) =>
        api.get('/audit-logs/export', { params: clean(params), responseType: 'blob' }).then((res) => res.data as Blob),
    purge: (days: number) =>
        api.delete<{ success: boolean; deleted: number; cutoff: string }>('/audit-logs/purge', { params: { days } })
            .then((res) => res.data),
};
