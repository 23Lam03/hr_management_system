import { useCallback, useContext } from 'react'

import { NotificationContext } from './notificationContext'

/**
 * useNotifications - hook truy cập NotificationContext.
 * Trả về null nếu thiếu Provider (để test/dev không crash).
 */
export default function useNotifications() {
  return useContext(NotificationContext)
}

export function useNotificationActions() {
  const ctx = useContext(NotificationContext)
  return useCallback(() => {
    if (!ctx) {
      return {
        markAsRead: async () => ({ ok: false, error: 'NotificationProvider missing.' }),
        markAsUnread: async () => ({ ok: false, error: 'NotificationProvider missing.' }),
        markAllAsRead: async () => ({ ok: false, error: 'NotificationProvider missing.' }),
        removeNotification: async () => ({ ok: false, error: 'NotificationProvider missing.' }),
      }
    }
    return {
      markAsRead: ctx.markAsRead,
      markAsUnread: ctx.markAsUnread,
      markAllAsRead: ctx.markAllAsRead,
      removeNotification: ctx.removeNotification,
      createNotification: ctx.createNotification,
      updateNotification: ctx.updateNotification,
    }
  }, [ctx])
}