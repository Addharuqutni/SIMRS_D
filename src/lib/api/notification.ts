import { api } from '../axios';
import type { Page, PageQuery } from '../../../shared/page';

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

/** Server status dimension for the list: read vs unread. */
export type NotificationStatus = 'baca' | 'belum_dibaca';

export const notificationApi = {
    list: (q: PageQuery) =>
        api.get<Page<AppNotification>>('/notifications', { params: q }).then((res) => res.data),
    getUnreadCount: () =>
        api.get<UnreadCount>('/notifications/unread-count').then((res) => res.data),
    markRead: (id: number) =>
        api.put<AppNotification>(`/notifications/${id}/read`).then((res) => res.data),
    markAllRead: () =>
        api.put<{ updated: number }>('/notifications/read-all').then((res) => res.data),
    deleteNotification: (id: number) =>
        api.delete<{ deleted: number }>(`/notifications/${id}`).then((res) => res.data),
};
