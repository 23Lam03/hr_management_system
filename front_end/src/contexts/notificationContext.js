import { createContext } from 'react'

/**
 * NotificationContext - chia sẻ state của notifications trong toàn app.
 *
 * Value shape:
 *   - notifications: Notification[]
 *   - unreadCount: number
 *   - loading: boolean
 *   - error: string | null
 *   - loadNotifications(): void
 *   - markAsRead(id): Promise<void>
 *   - markAsUnread(id): Promise<void>
 *   - markAllAsRead(): Promise<void>
 *   - removeNotification(id): Promise<void>
 *   - createNotification(data): Promise<{ok, ...}>
 *   - updateNotification(id, data): Promise<{ok, ...}>
 */
export const NotificationContext = createContext(null)