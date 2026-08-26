import { api } from '../axios';
import type { AxiosResponse } from 'axios';

/** Mirrors the `notifications` table (server/src/db/schemas/notify.ts). */
export interface AppNotification {
    id: number;
    userId: string | null;
    title: string;
    message: string;
    /** info | success | warning | error */
    type: string;
    isRead: boolean;
    linkUrl: string | null;
    createdAt: string;
}

export interface UnreadCount {
    count: number;
}

export const notificationApi = {
    getNotifications: (unread?: boolean) =>
        api.get<AppNotification[]>('/notifications', { params: unread ? { unread: 'true' } : undefined })
            .then((res: AxiosResponse<AppNotification[]>) => res.data),
    getUnreadCount: () =>
        api.get<UnreadCount>('/notifications/unread-count')
            .then((res: AxiosResponse<UnreadCount>) => res.data),
    markRead: (id: number) =>
        api.put<AppNotification>(`/notifications/${id}/read`)
            .then((res: AxiosResponse<AppNotification>) => res.data),
    markAllRead: () =>
        api.put<{ updated: number }>('/notifications/read-all')
            .then((res: AxiosResponse<{ updated: number }>) => res.data),
    deleteNotification: (id: number) =>
        api.delete<{ deleted: number }>(`/notifications/${id}`)
            .then((res: AxiosResponse<{ deleted: number }>) => res.data),
};
