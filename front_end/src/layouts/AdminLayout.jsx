import { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'
import Breadcrumb from '../components/common/Breadcrumb'
import { useAuth } from '../contexts/useAuth'
import { ROLES } from '../contexts/roles'
import { adminNavigation } from '../config/navigationConfig'

/**
 * AdminLayout - shared layout for /admin/*.
 * User/logout/sidebar/header lấy trực tiếp từ AuthContext.
 * Notification data lấy từ NotificationContext (Header fallback tự đọc).
 * Nếu role không phải admin -> redirect /access-denied (xử lý ở ProtectedRoute).
 */
export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()
  const { role } = useAuth()
  const breadcrumbItems = useMemo(() => buildBreadcrumb(pathname), [pathname])

  // Phòng trường hợp người dùng gõ URL thẳng vào /admin/* dù chưa đăng nhập.
  // ProtectedRoute cha đã chặn, nhưng layout vẫn kiểm tra lại để an toàn.
  if (role !== ROLES.ADMIN) {
    return <Navigate to="/access-denied" replace state={{ from: pathname }} />
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar
        navigation={adminNavigation}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((p) => !p)}
        footerText="v0.14.0 · Phần 14 - Notification"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onToggleSidebar={() => setMobileOpen((p) => !p)}
          breadcrumb={<Breadcrumb items={breadcrumbItems} />}
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function buildBreadcrumb(pathname) {
  const items = [{ label: 'Quản trị', to: '/admin' }]
  if (pathname === '/admin') return items
  const flat = adminNavigation.flatMap((g) => g.items)
  const match = flat.find((it) =>
    it.exact ? it.to === pathname : pathname.startsWith(it.to),
  )
  if (match) items.push({ label: match.label })
  return items
}