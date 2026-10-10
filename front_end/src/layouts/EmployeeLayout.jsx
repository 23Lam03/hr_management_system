import { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'
import Breadcrumb from '../components/common/Breadcrumb'
import { useAuth } from '../contexts/useAuth'
import { ROLES } from '../contexts/roles'
import { employeeNavigation } from '../config/navigationConfig'

/**
 * EmployeeLayout - self-service portal layout.
 * User/logout/sidebar/header lấy trực tiếp từ AuthContext.
 * Notification data từ NotificationContext (Header fallback tự đọc).
 */
export default function EmployeeLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()
  const { role } = useAuth()
  const breadcrumbItems = useMemo(() => buildBreadcrumb(pathname), [pathname])

  if (role !== ROLES.EMPLOYEE) {
    return <Navigate to="/access-denied" replace state={{ from: pathname }} />
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar
        brand={{ title: 'Employee Portal', subtitle: 'Cổng nhân viên' }}
        navigation={employeeNavigation}
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
  const items = [{ label: 'Cổng nhân viên', to: '/employee' }]
  if (pathname === '/employee') return items
  const flat = employeeNavigation.flatMap((g) => g.items)
  const match = flat.find((it) =>
    it.exact ? it.to === pathname : pathname.startsWith(it.to),
  )
  if (match) items.push({ label: match.label })
  return items
}