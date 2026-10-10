import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { SupportContext } from './supportContext'
import {
  getSupportRequestsByUser,
  createSupportRequest as svcCreate,
  updateSupportRequest as svcUpdate,
  updateSupportStatus as svcStatus,
  assignSupportRequest as svcAssign,
  addSupportMessage as svcMessage,
  deleteSupportRequest as svcDelete,
  subscribeSupportRequests,
} from '../services/supportService'

import { useAuth } from './useAuth'

function snapshotFor(userId) {
  if (!userId) return { requests: [], summary: emptySummary() }
  const list = getSupportRequestsByUser(userId)
  return {
    requests: list,
    summary: {
      total: list.length,
      open: list.filter((r) => r.status === 'open').length,
      inProgress: list.filter((r) => r.status === 'in_progress').length,
      waiting: list.filter((r) => r.status === 'waiting_for_employee').length,
      resolved: list.filter((r) => r.status === 'resolved').length,
    },
  }
}

function emptySummary() {
  return { total: 0, open: 0, inProgress: 0, waiting: 0, resolved: 0 }
}

let cachedSnapshot = { requests: [], summary: emptySummary() }

const subscribers = new Set()
function emitChange() {
  for (const cb of subscribers) cb()
}

function subscribe(cb) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

/**
 * SupportProvider - mount 1 lần trong App.
 *
 * - Subscribe pub-sub từ supportService.
 * - Lọc requests theo user hiện tại.
 * - Cung cấp các action CRUD.
 */
export function SupportProvider({ children }) {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const unsub = subscribeSupportRequests(() => {
      cachedSnapshot = snapshotFor(user?.id)
      setVersion((v) => v + 1)
      emitChange()
    })
    return () => unsub()
  }, [user?.id])

  useEffect(() => {
    cachedSnapshot = snapshotFor(user?.id)
    // eslint-disable-next-line react/set-state-in-effect
    setVersion((v) => v + 1)
    emitChange()
  }, [user?.id])

  const snapshot = useSyncExternalStore(
    subscribe,
    () => cachedSnapshot,
    () => cachedSnapshot,
  )

  const createRequest = useCallback(async (data) => {
    if (!user) return { ok: false, errors: { _form: 'Bạn chưa đăng nhập.' } }
    const payload = { ...data, requesterId: user.id }
    return svcCreate(payload)
  }, [user])

  const updateRequest = useCallback(async (id, data) => {
    return svcUpdate(id, data)
  }, [])

  const updateStatus = useCallback(async (id, status) => {
    return svcStatus(id, status)
  }, [])

  const assignRequest = useCallback(async (id, adminId) => {
    return svcAssign(id, adminId)
  }, [])

  const addMessage = useCallback(async (id, message) => {
    return svcMessage(id, message)
  }, [])

  const removeRequest = useCallback(async (id) => {
    return svcDelete(id)
  }, [])

  const value = useMemo(
    () => ({
      requests: snapshot.requests,
      summary: snapshot.summary,
      loading: false,
      version,
      userId: user?.id ?? null,
      loadRequests: () => emitChange(),
      createRequest,
      updateRequest,
      updateStatus,
      assignRequest,
      addMessage,
      removeRequest,
    }),
    [
      snapshot.requests,
      snapshot.summary,
      version,
      user?.id,
      createRequest,
      updateRequest,
      updateStatus,
      assignRequest,
      addMessage,
      removeRequest,
    ],
  )

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>
}