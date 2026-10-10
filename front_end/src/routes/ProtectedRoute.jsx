import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../contexts/useAuth'

/**
 * ProtectedRoute
 *
 * - Chờ `initializing` để khôi phục phiên từ localStorage trước khi quyết định.
 * - Chưa đăng nhập -> chuyển tới /login kèm `from` (đường dẫn nội bộ).
 * - Sai role -> chuyển tới /access-denied.
 *
 * Props:
 * - allowedRoles?: Array<'admin' | 'employee'>
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, initializing, role } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <span
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-r-transparent"
            aria-hidden="true"
          />
          <p className="text-sm text-neutral-500">Đang khôi phục phiên…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const from =
      location.pathname && location.pathname !== '/login'
        ? `${location.pathname}${location.search || ''}`
        : null
    return <Navigate to="/login" replace state={from ? { from } : null} />
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/access-denied" replace state={{ from: location.pathname, currentRole: role }} />
  }

  return children ?? <Outlet />
}