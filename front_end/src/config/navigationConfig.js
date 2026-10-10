/**
 * Centralized navigation menu definitions.
 * Each layout (AdminLayout, EmployeeLayout) imports its own config and passes
 * it to the shared <Sidebar />.
 */

import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarDays,
  FileText,
  Wallet,
  GraduationCap,
  Gift,
  FileSignature,
  Settings,
  Star,
  UserCircle,
  ClipboardList,
  BookOpen,
  Bell,
  LifeBuoy,
  ShieldCheck,
  BarChart3,
  UserPlus,
  Award,
  UserCog,
} from 'lucide-react'

export const adminNavigation = [
  {
    title: 'Tổng quan',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: 'Nhân sự',
    items: [
      { to: '/admin/employees', label: 'Nhân viên', icon: Users },
      { to: '/admin/departments', label: 'Phòng ban', icon: Briefcase },
    ],
  },
  {
    title: 'Vận hành',
    items: [
      { to: '/admin/attendance', label: 'Chấm công', icon: CalendarDays },
      { to: '/admin/leaves', label: 'Nghỉ phép', icon: FileText },
      { to: '/admin/payroll', label: 'Lương', icon: Wallet },
      { to: '/admin/evaluations', label: 'Đánh giá hiệu suất', icon: Star },
      { to: '/admin/trainings', label: 'Quản lý đào tạo', icon: GraduationCap },
      { to: '/admin/benefits', label: 'Quản lý phúc lợi', icon: Gift },
      { to: '/admin/contracts', label: 'Quản lý hợp đồng', icon: FileSignature },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { to: '/admin/reports', label: 'Báo cáo', icon: BarChart3 },
      { to: '/admin/recruitment', label: 'Recruitment', icon: UserPlus },
      { to: '/admin/promotions', label: 'Promotions', icon: Award },
      { to: '/admin/security', label: 'Bảo mật', icon: ShieldCheck },
      { to: '/admin/support', label: 'Hỗ trợ', icon: LifeBuoy },
      { to: '/admin/notifications', label: 'Thông báo', icon: Bell },
      { to: '/admin/settings', label: 'System Configuration', icon: Settings },
    ],
  },
]

export const employeeNavigation = [
  {
    title: 'Cá nhân',
    items: [
      { to: '/employee', label: 'Trang chủ', icon: UserCircle, exact: true },
    ],
  },
  {
    title: 'Công việc',
    items: [
      { to: '/employee/profile', label: 'Hồ sơ', icon: ClipboardList },
      { to: '/employee/account', label: 'Account', icon: UserCog },
      { to: '/employee/attendance', label: 'Chấm công', icon: CalendarDays },
      { to: '/employee/leaves', label: 'Nghỉ phép', icon: FileText },
      { to: '/employee/payroll', label: 'Phiếu lương', icon: Wallet },
      { to: '/employee/evaluations', label: 'Đánh giá của tôi', icon: Star },
      { to: '/employee/trainings', label: 'Đào tạo của tôi', icon: BookOpen },
      { to: '/employee/benefits', label: 'Phúc lợi của tôi', icon: Gift },
      { to: '/employee/contracts', label: 'Hợp đồng của tôi', icon: FileText },
      { to: '/employee/notifications', label: 'Thông báo', icon: Bell },
      { to: '/employee/support', label: 'Hỗ trợ', icon: LifeBuoy },
      { to: '/employee/promotions', label: 'My Promotions', icon: Award },
      { to: '/employee/reports', label: 'Reports', icon: BarChart3 },
      { to: '/employee/jobs', label: 'Internal Jobs', icon: Briefcase },
    ],
  },
]