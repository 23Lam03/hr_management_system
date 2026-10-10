import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { NotificationContext } from './notificationContext'
import {
  getNotificationsByUser,
  markAsRead as svcMarkAsRead,
  markAsUnread as svcMarkAsUnread,
  markAllAsRead as svcMarkAllAsRead,
  deleteNotification as svcDelete,
  createNotification as svcCreate,
  updateNotification as svcUpdate,
  subscribeNotifications,
} from '../services/notificationService'

import { useAuth } from './useAuth'

let cachedSnapshot = { notifications: [], unreadCount: 0 }

function computeSnapshot(userId) {
  const list = userId ? getNotificationsByUser(userId) : []
  const unread = list.filter((n) => !n.isRead).length
  return { notifications: list, unreadCount: unread }
}

const subscribers = new Set()
function emitChange() {
  for (const cb of subscribers) cb()
}

function subscribe(cb) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

/**
 * NotificationProvider - mount 1 lần trong App.
 *
 * - Subscribe pub-sub từ notificationService.
 * - Lọc notifications theo user hiện tại (recipientId === user.id).
 * - Nếu chưa đăng nhập, trả về danh sách rỗng.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth()

  // Loading initial = true để tránh flash dữ liệu cũ.
  const [loading, setLoading] = useState(() => {
    cachedSnapshot = computeSnapshot(undefined)
    return true
  })
  const [error, setError] = useState(null)

  // Subscribe pub-sub
  useEffect(() => {
    const unsub = subscribeNotifications(() => {
      cachedSnapshot = computeSnapshot(user?.id)
      emitChange()
    })
    return () => unsub()
  }, [user?.id])

  // Recompute snapshot khi user đổi.
  useEffect(() => {
    cachedSnapshot = computeSnapshot(user?.id)
    emitChange()
    const t = window.setTimeout(() => {
      setLoading(false)
      setError(null)
    }, 150)
    return () => window.clearTimeout(t)
  }, [user?.id])

  const snapshot = useSyncExternalStore(
    subscribe,
    () => cachedSnapshot,
    () => cachedSnapshot,
  )

  const markAsRead = useCallback(async (id) => {
    try {
      const r = await svcMarkAsRead(id)
      if (!r.ok) setError(r.error || 'Không thể cập nhật.')
      return r
    } catch (e) {
      setError(e?.message || 'Có lỗi xảy ra.')
      return { ok: false }
    }
  }, [])

  const markAsUnread = useCallback(async (id) => {
    try {
      const r = await svcMarkAsUnread(id)
      if (!r.ok) setError(r.error || 'Không thể cập nhật.')
      return r
    } catch (e) {
      setError(e?.message || 'Có lỗi xảy ra.')
      return { ok: false }
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!user) return { ok: false }
    try {
      const r = await svcMarkAllAsRead(user.id)
      if (!r.ok) setError('Không thể cập nhật.')
      return r
    } catch (e) {
      setError(e?.message || 'Có lỗi xảy ra.')
      return { ok: false }
    }
  }, [user])

  const removeNotification = useCallback(async (id) => {
    try {
      const r = await svcDelete(id)
      if (!r.ok) setError(r.error || 'Không thể xoá.')
      return r
    } catch (e) {
      setError(e?.message || 'Có lỗi xảy ra.')
      return { ok: false }
    }
  }, [])

  const createNotification = useCallback(async (data) => {
    try {
      const r = await svcCreate(data)
      if (!r.ok) setError(r.errors?._form || 'Không thể tạo.')
      return r
    } catch (e) {
      setError(e?.message || 'Có lỗi xảy ra.')
      return { ok: false }
    }
  }, [])

  const updateNotification = useCallback(async (id, data) => {
    try {
      const r = await svcUpdate(id, data)
      if (!r.ok) setError(r.errors?._form || 'Không thể cập nhật.')
      return r
    } catch (e) {
      setError(e?.message || 'Có lỗi xảy ra.')
      return { ok: false }
    }
  }, [])

  const value = {
    notifications: snapshot.notifications,
    unreadCount: snapshot.unreadCount,
    loading,
    error,
    userId: user?.id ?? null,
    loadNotifications: () => emitChange(),
    markAsRead,
    markAsUnread,
    markAllAsRead,
    removeNotification,
    createNotification,
    updateNotification,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}