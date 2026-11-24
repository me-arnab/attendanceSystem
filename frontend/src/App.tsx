import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PlatformConfigProvider } from './context/PlatformConfigContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { UnauthorizedPage, NotFoundPage } from './pages/ErrorPages';

// Super Admin Pages
import { SuperAdminDashboard } from './pages/super-admin/SuperAdminDashboard';
import { CompaniesPage } from './pages/super-admin/CompaniesPage';
import { CreateCompanyPage } from './pages/super-admin/CreateCompanyPage';
import { CompanyDetailsPage } from './pages/super-admin/CompanyDetailsPage';
import { PlatformSettingsPage } from './pages/super-admin/PlatformSettingsPage';

// Company Admin Pages
import { CompanyAdminDashboard } from './pages/company-admin/CompanyAdminDashboard';
import { EmployeesPage } from './pages/company-admin/EmployeesPage';
import { DepartmentsPage } from './pages/company-admin/DepartmentsPage';
import { AttendancePage } from './pages/company-admin/AttendancePage';
import { HolidaysPage } from './pages/company-admin/HolidaysPage';
import { ReportsPage } from './pages/company-admin/ReportsPage';
import { CompanySettingsPage } from './pages/company-admin/CompanySettingsPage';
import { AuditLogsPage } from './pages/company-admin/AuditLogsPage';

// Employee Pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { EmployeeHistoryPage } from './pages/employee/EmployeeHistoryPage';
import { EmployeeHolidaysPage } from './pages/employee/EmployeeHolidaysPage';

// Common Account Pages
import { ChangePasswordPage } from './pages/common/ChangePasswordPage';
import { ChatPage } from './pages/common/ChatPage';

// Root Redirector based on user role
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'SUPER_ADMIN') {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (user.role === 'COMPANY_ADMIN') {
    return <Navigate to="/company/dashboard" replace />;
  }

  return <Navigate to="/employee/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <PlatformConfigProvider>
          <AuthProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Root / */}
              <Route path="/" element={<RootRedirect />} />

              {/* Protected Authenticated Layout Routes */}
              <Route element={<AppLayout />}>
                {/* 1. Super Admin Portal */}
                <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
                  <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
                  <Route path="/super-admin/companies" element={<CompaniesPage />} />
                  <Route path="/super-admin/companies/create" element={<CreateCompanyPage />} />
                  <Route path="/super-admin/companies/:id" element={<CompanyDetailsPage />} />
                  <Route path="/super-admin/settings" element={<PlatformSettingsPage />} />
                  <Route path="/super-admin/change-password" element={<ChangePasswordPage />} />
                </Route>

                {/* 2. Company Admin Portal */}
                <Route element={<ProtectedRoute allowedRoles={['COMPANY_ADMIN']} />}>
                  <Route path="/company/dashboard" element={<CompanyAdminDashboard />} />
                  <Route path="/company/chat" element={<ChatPage />} />
                  <Route path="/company/employees" element={<EmployeesPage />} />
                  <Route path="/company/departments" element={<DepartmentsPage />} />
                  <Route path="/company/attendance" element={<AttendancePage />} />
                  <Route path="/company/holidays" element={<HolidaysPage />} />
                  <Route path="/company/reports" element={<ReportsPage />} />
                  <Route path="/company/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/company/settings" element={<CompanySettingsPage />} />
                  <Route path="/company/change-password" element={<ChangePasswordPage />} />
                </Route>

                {/* 3. Employee Self-Service Portal */}
                <Route element={<ProtectedRoute allowedRoles={['EMPLOYEE']} />}>
                  <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
                  <Route path="/employee/chat" element={<ChatPage />} />
                  <Route path="/employee/history" element={<EmployeeHistoryPage />} />
                  <Route path="/employee/holidays" element={<EmployeeHolidaysPage />} />
                  <Route path="/employee/change-password" element={<ChangePasswordPage />} />
                </Route>
              </Route>

              {/* Fallback 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </PlatformConfigProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};
