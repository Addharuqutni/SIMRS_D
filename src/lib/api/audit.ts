import { api } from '../axios';

export interface AuditLog {
    id: number;
    userId: string;
    userName: string | null;
    method: string;
    path: string;
    body: string | null;
    ip: string | null;
    createdAt: string;
}

export interface AuditLogListResponse {
    data: AuditLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface AuditLogQuery {
    page?: number;
    limit?: number;
    userId?: string;
    method?: string;
    path?: string;
    startDate?: string;
    endDate?: string;
}

export const auditApi = {
    list: async (params: AuditLogQuery): Promise<AuditLogListResponse> => {
        const res = await api.get('/audit-logs', { params });
        return res.data;
    },
};
