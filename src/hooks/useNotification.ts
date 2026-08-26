import { useQuery } from '@tanstack/react-query';
import { useList, useMutate } from '../lib/query';
import { notificationApi } from '../lib/api/notification';

export const useNotifications = (unread = false) =>
    useList('notifications', () => notificationApi.getNotifications(unread));

// Polled by the Topbar badge; mutations below invalidate the same key.
export const useUnreadCount = () =>
    useQuery<number>({
        queryKey: ['unread-count'],
        queryFn: () => notificationApi.getUnreadCount().then((r) => r.count),
        refetchInterval: 30000,
    });

export const useMarkNotificationRead = () =>
    useMutate((id: number) => notificationApi.markRead(id), 'notifications', 'unread-count');

export const useMarkAllNotificationsRead = () =>
    useMutate(() => notificationApi.markAllRead(), 'notifications', 'unread-count');

export const useDeleteNotification = () =>
    useMutate((id: number) => notificationApi.deleteNotification(id), 'notifications', 'unread-count');

// No bulk-delete endpoint: clear-all fans out to individual owned deletes.
export const useClearNotifications = () =>
    useMutate((ids: number[]) => Promise.all(ids.map((id) => notificationApi.deleteNotification(id))), 'notifications', 'unread-count');
