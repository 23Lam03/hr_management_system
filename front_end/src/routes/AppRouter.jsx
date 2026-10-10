import { Navigate, Route, Routes } from 'react-router-dom'

import AdminLayout from '../layouts/AdminLayout'
import EmployeeLayout from '../layouts/EmployeeLayout'
import AuthLayout from '../layouts/AuthLayout'

import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'

import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import AdminEmployeesPage from '../pages/admin/AdminEmployeesPage'
import AdminAttendancePage from '../pages/admin/AdminAttendancePage'
import AdminLeavesPage from '../pages/admin/AdminLeavesPage'
import AdminPayrollPage from '../pages/admin/AdminPayrollPage'
import AdminEvaluationsPage from '../pages/admin/AdminEvaluationsPage'
import AdminEvaluationCyclePage from '../pages/admin/AdminEvaluationCyclePage'
import AdminTrainingsPage from '../pages/admin/AdminTrainingsPage'
import AdminTrainingDetailPage from '../pages/admin/AdminTrainingDetailPage'
import AdminBenefitsPage from '../pages/admin/AdminBenefitsPage'
import AdminBenefitDetailPage from '../pages/admin/AdminBenefitDetailPage'
import AdminContractsPage from '../pages/admin/AdminContractsPage'
import AdminContractDetailPage from '../pages/admin/AdminContractDetailPage'
import AdminNotificationsPage from '../pages/admin/AdminNotificationsPage'
import AdminSupportPage from '../pages/admin/AdminSupportPage'
import AdminSecurityPage from '../pages/admin/AdminSecurityPage'
import AdminReportsPage from '../pages/admin/AdminReportsPage'
import SystemConfigurationPage from '../pages/admin/SystemConfigurationPage'
import RecruitmentPage from '../pages/admin/RecruitmentPage'
import PromotionManagementPage from '../pages/admin/PromotionManagementPage'
import AdminPlaceholderPage from '../pages/admin/AdminPlaceholderPage'

import EmployeeDashboardPage from '../pages/employee/EmployeeDashboardPage'
import EmployeeLeavesPage from '../pages/employee/EmployeeLeavesPage'
import EmployeePayrollPage from '../pages/employee/EmployeePayrollPage'
import EmployeeEvaluationsPage from '../pages/employee/EmployeeEvaluationsPage'
import EmployeeEvaluationDetailPage from '../pages/employee/EmployeeEvaluationDetailPage'
import EmployeeTrainingsPage from '../pages/employee/EmployeeTrainingsPage'
import EmployeeTrainingDetailPage from '../pages/employee/EmployeeTrainingDetailPage'
import EmployeeBenefitsPage from '../pages/employee/EmployeeBenefitsPage'
import EmployeeBenefitDetailPage from '../pages/employee/EmployeeBenefitDetailPage'
import EmployeeContractsPage from '../pages/employee/EmployeeContractsPage'
import EmployeeContractDetailPage from '../pages/employee/EmployeeContractDetailPage'
import EmployeeNotificationsPage from '../pages/employee/EmployeeNotificationsPage'
import EmployeeSupportPage from '../pages/employee/EmployeeSupportPage'
import PromotionTrackingPage from '../pages/employee/PromotionTrackingPage'
import EmployeeProfilePage from '../pages/employee/EmployeeProfilePage'
import EmployeeAccountPage from '../pages/employee/EmployeeAccountPage'
import EmployeeReportsPage from '../pages/employee/EmployeeReportsPage'
import EmployeeJobsPage from '../pages/employee/EmployeeJobsPage'
import EmployeePlaceholderPage from '../pages/employee/EmployeePlaceholderPage'
import EmployeeAttendancePage from '../pages/employee/EmployeeAttendancePage'

import UIDemoPage from '../pages/shared/UIDemoPage'
import NotFoundPage from '../pages/shared/NotFoundPage'
import AccessDeniedPage from '../pages/shared/AccessDeniedPage'

import ProtectedRoute from './ProtectedRoute'
import { ROLES } from '../contexts/roles'

/**
 * AppRouter - central route table.
 *
 * Phần 3 - Auth & RBAC:
 * - /login là entry point cho người chưa đăng nhập (ProtectedRoute sẽ tự
 *   redirect mọi route bảo vệ về đây, kèm state.from).
 * - /admin/** chỉ cho role 'admin'; /employee/** chỉ cho role 'employee'.
 * - /access-denied thông báo khi đăng nhập đúng nhưng sai khu vực.
 * - Đã đăng nhập mà vào /login sẽ bị đẩy về home theo role (LoginPage tự xử lý).
 */
export default function AppRouter() {
  return (
    <Routes>
      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        {/* Backward compat - route cũ vẫn đưa vào LoginPage */}
        <Route path="/auth/login" element={<Navigate to="/login" replace />} />
        <Route path="/auth/register" element={<Navigate to="/register" replace />} />
      </Route>

      {/* Access-denied - không cần đăng nhập cũng xem được (để debug UX) */}
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      {/* UI Demo - dành cho cả 2 role để xem component */}
      <Route
        path="/ui-demo"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.EMPLOYEE]}>
            <AdminLayout>
              <UIDemoPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="employees" element={<AdminEmployeesPage />} />
        <Route path="departments" element={<AdminPlaceholderPage kind="departments" />} />
        <Route path="attendance" element={<AdminAttendancePage />} />
        <Route path="leaves" element={<AdminLeavesPage />} />
        <Route path="leave" element={<Navigate to="/admin/leaves" replace />} />
        <Route path="payroll" element={<AdminPayrollPage />} />
        <Route path="evaluations" element={<AdminEvaluationsPage />} />
        <Route path="evaluations/:id" element={<AdminEvaluationCyclePage />} />
        <Route path="evaluation" element={<Navigate to="/admin/evaluations" replace />} />
        <Route path="training" element={<Navigate to="/admin/trainings" replace />} />
        <Route path="trainings" element={<AdminTrainingsPage />} />
        <Route path="trainings/:id" element={<AdminTrainingDetailPage />} />
        <Route path="benefits" element={<AdminBenefitsPage />} />
        <Route path="benefits/:id" element={<AdminBenefitDetailPage />} />
        <Route path="contracts" element={<AdminContractsPage />} />
        <Route path="contracts/:id" element={<AdminContractDetailPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="support" element={<AdminSupportPage />} />
        <Route path="security" element={<AdminSecurityPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="recruitment" element={<RecruitmentPage />} />
        <Route path="promotions" element={<PromotionManagementPage />} />
        <Route path="settings" element={<SystemConfigurationPage />} />
      </Route>

      {/* Employee self-service */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={[ROLES.EMPLOYEE]}>
            <EmployeeLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeDashboardPage />} />
        <Route path="profile" element={<EmployeeProfilePage />} />
        <Route path="attendance" element={<EmployeeAttendancePage />} />
        <Route path="leaves" element={<EmployeeLeavesPage />} />
        <Route path="leave" element={<Navigate to="/employee/leaves" replace />} />
        <Route path="payroll" element={<EmployeePayrollPage />} />
        <Route path="evaluations" element={<EmployeeEvaluationsPage />} />
        <Route path="evaluations/:id" element={<EmployeeEvaluationDetailPage />} />
        <Route path="evaluation" element={<Navigate to="/employee/evaluations" replace />} />
        <Route path="training" element={<Navigate to="/employee/trainings" replace />} />
        <Route path="trainings" element={<EmployeeTrainingsPage />} />
        <Route path="trainings/:id" element={<EmployeeTrainingDetailPage />} />
        <Route path="benefits" element={<EmployeeBenefitsPage />} />
        <Route path="benefits/:id" element={<EmployeeBenefitDetailPage />} />
        <Route path="contracts" element={<EmployeeContractsPage />} />
        <Route path="contracts/:id" element={<EmployeeContractDetailPage />} />
        <Route path="notifications" element={<EmployeeNotificationsPage />} />
        <Route path="support" element={<EmployeeSupportPage />} />
        <Route path="promotions" element={<PromotionTrackingPage />} />
        <Route path="account" element={<EmployeeAccountPage />} />
        <Route path="reports" element={<EmployeeReportsPage />} />
        <Route path="jobs" element={<EmployeeJobsPage />} />
        <Route path="*" element={<EmployeeDashboardPage />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}