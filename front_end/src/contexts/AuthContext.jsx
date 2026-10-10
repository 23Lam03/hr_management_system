import { useCallback, useEffect, useMemo, useState } from 'react'

import { AuthContext } from './authContext'
import { ROLE_VALUES } from './roles'
import {
  login as loginRequest,
  changePassword as changePasswordRequest,
  logout as logoutRequest,
  refreshSession,
  USE_MOCK,
} from '../services/authService'
import tokenStore from '../services/tokenStore'

/**
 * AuthProvider - global session state.
 *
 * Phase 18 real-backend integration:
 *   - In MOCK mode: the previous localStorage-backed behaviour is
 *     preserved so the UI can still be developed offline.
 *   - In REAL mode: NO localStorage / sessionStorage is used.
 *     The access + refresh tokens live ONLY in `tokenStore`
 *     (JavaScript memory). A page reload therefore logs the user
 *     out — this is the documented trade-off of not having
 *     HttpOnly cookies set by the backend. The AuthProvider
 *     attempts a silent `refreshSession()` on mount; if the
 *     backend accepts the (memory-only) refresh token the session
 *     continues, otherwise the user is shown the login page.
 *
 * Security rules (do not break):
 *   - NEVER persist access or refresh tokens.
 *   - NEVER persist passwords.
 *   - Always validate the shape of a restored user before trusting
 *     it. A malformed payload must NOT crash the app.
 */

const STORAGE_KEY = 'hrm.session.v1'
const ROLE_SET = new Set(ROLE_VALUES)

function isValidUserPayload(value) {
  if (!value || typeof value !== 'object') return false
  if (typeof value.id !== 'string' || !value.id) return false
  if (typeof value.email !== 'string' || !value.email) return false
  if (typeof value.name !== 'string' || !value.name) return false
  if (typeof value.role !== 'string' || !ROLE_SET.has(value.role)) return false
  if ('password' in value) return false
  return true
}

function readPersistedUser() {
  // MOCK mode: keep restoring from localStorage so the demo flow
  // is unchanged. Real mode: nothing to restore (memory-only).
  if (!USE_MOCK) return null
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isValidUserPayload(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function persistUser(user) {
  if (!USE_MOCK) return // real mode: in-memory only
  if (typeof window === 'undefined') return
  try {
    if (!user) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else if (isValidUserPayload(user)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    }
  } catch {
    /* storage full or disabled - silently ignore */
  }
}

export function AuthProvider({ children }) {
  const [boot] = useState(() => ({
    user: readPersistedUser(),
    initializing: USE_MOCK ? false : true, // real mode: we may attempt a silent refresh on mount
  }))
  const [user, setUser] = useState(boot.user)
  const [initializing, setInitializing] = useState(boot.initializing)

  // REAL-mode: try a silent refresh on mount. The refresh token
  // (if any was kept in memory across an HMR) is in tokenStore.
  // In a real cold-start the store is empty so this is a no-op.
  useEffect(() => {
    if (USE_MOCK) return undefined
    let cancelled = false
    ;(async () => {
      try {
        if (tokenStore.getRefreshToken()) {
          const result = await refreshSession()
          if (cancelled) return
          if (result && result.accessToken) {
            // We now have a fresh access token but the server did
            // not return a fresh user object. Trigger an implicit
            // /auth/me call via authService if we add one later;
            // for now we just consider the user "authenticated"
            // with the previously cached user object.
            // (A future phase can call httpClient.get('/api/auth/me').)
          }
        }
      } catch {
        // Refresh failed — token store already cleared by the
        // httpClient's 401 handling. Nothing to do.
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Listen for the httpClient's "auth expired" event.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handler = () => {
      setUser(null)
    }
    window.addEventListener('hrm:auth:expired', handler)
    return () => window.removeEventListener('hrm:auth:expired', handler)
  }, [])

  const login = useCallback(async (email, password) => {
    const next = await loginRequest(email, password)
    setUser(next)
    persistUser(next)
    return next
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // Even on network failure, log out locally.
    }
    setUser(null)
    persistUser(null)
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) throw new Error('NOT_AUTHENTICATED')
    return await changePasswordRequest(user.id, currentPassword, newPassword)
  }, [user])

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      persistUser(next)
      return next
    })
  }, [])

  // Defensive cleanup: if role becomes invalid, force logout.
  useEffect(() => {
    if (!user) return
    if (!ROLE_SET.has(user.role)) {
      if (typeof window !== 'undefined' && USE_MOCK) {
        window.localStorage.removeItem(STORAGE_KEY)
      }
      setUser(null)
    }
  }, [user])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      initializing,
      login,
      logout,
      updateUser,
      changePassword,
      role: user?.role ?? null,
      hasRole: (role) => Boolean(user) && user.role === role,
    }),
    [user, initializing, login, logout, updateUser, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
