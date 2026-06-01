/**
 * notificationApi.ts — Axios wrappers for in-app Notifications.
 */
import { apiClient } from './apiClient';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reimbursement_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unread_count: number;
}

/**
 * GET /api/notifications/list
 */
export const listNotificationsApi = async (
  iLimit: number = 50,
  bUnreadOnly: boolean = false,
): Promise<NotificationListResponse> => {
  const objResp = await apiClient.get<NotificationListResponse>('/api/notifications/list', {
    params: { limit: iLimit, unread_only: bUnreadOnly },
  });
  return objResp.data;
};

/**
 * GET /api/notifications/unread-count
 */
export const getUnreadCountApi = async (): Promise<number> => {
  const objResp = await apiClient.get<{ unread_count: number }>('/api/notifications/unread-count');
  return objResp.data.unread_count;
};

/**
 * POST /api/notifications/mark-read
 */
export const markReadApi = async (
  lsIds: string[] = [],
  bMarkAll: boolean = false,
): Promise<{ success: boolean; updated: number }> => {
  const objResp = await apiClient.post<{ success: boolean; updated: number }>(
    '/api/notifications/mark-read',
    { notification_ids: lsIds, mark_all: bMarkAll },
  );
  return objResp.data;
};

/**
 * DELETE /api/notifications/:id
 */
export const deleteNotificationApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/notifications/${strId}`);
};
