import { Outlet } from 'react-router-dom'

const COPYRIGHT_YEAR = new Date().getFullYear()

/**
 * AuthLayout - centered shell for login / forgot-password.
 */
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-neutral-50 to-brand-100 p-6">
      <div className="w-full max-w-[420px] rounded-xl border border-neutral-200 bg-white p-8 shadow-elevated">
        <Outlet />
      </div>
      <footer className="mt-6 text-xs text-neutral-500">
        © {COPYRIGHT_YEAR} HRM System · Nền tảng quản trị nhân sự
      </footer>
    </div>
  )
}