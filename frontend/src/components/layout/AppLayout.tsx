import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePlatformConfig } from '../../context/PlatformConfigContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  FileBarChart,
  Settings,
  ShieldCheck,
  FolderTree,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ClipboardList,
  Clock,
  History,
  CalendarDays,
  KeyRound,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../ui/Button';

export const AppLayout: React.FC = () => {
  const { user, company, logout } = useAuth();
  const { platformName } = usePlatformConfig();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    if (!user) return [];

    if (user.role === 'SUPER_ADMIN') {
      return [
        { name: 'Dashboard', path: '/super-admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { name: 'Companies', path: '/super-admin/companies', icon: <Building2 className="w-4 h-4" /> },
        { name: 'Register Company', path: '/super-admin/companies/create', icon: <ShieldCheck className="w-4 h-4" /> },
        { name: 'Platform Settings', path: '/super-admin/settings', icon: <Settings className="w-4 h-4" /> },
        { name: 'Change Password', path: '/super-admin/change-password', icon: <KeyRound className="w-4 h-4" /> },
      ];
    }

    if (user.role === 'COMPANY_ADMIN') {
      return [
        { name: 'Dashboard', path: '/company/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { name: 'Company Chat', path: '/company/chat', icon: <MessageSquare className="w-4 h-4" /> },
        { name: 'Employees', path: '/company/employees', icon: <Users className="w-4 h-4" /> },
        { name: 'Departments', path: '/company/departments', icon: <FolderTree className="w-4 h-4" /> },
        { name: 'Attendance', path: '/company/attendance', icon: <CalendarCheck className="w-4 h-4" /> },
        { name: 'Holidays', path: '/company/holidays', icon: <CalendarDays className="w-4 h-4" /> },
        { name: 'Reports', path: '/company/reports', icon: <FileBarChart className="w-4 h-4" /> },
        { name: 'Audit Logs', path: '/company/audit-logs', icon: <ClipboardList className="w-4 h-4" /> },
        { name: 'Company Settings', path: '/company/settings', icon: <Settings className="w-4 h-4" /> },
        { name: 'Change Password', path: '/company/change-password', icon: <KeyRound className="w-4 h-4" /> },
      ];
    }

    // EMPLOYEE
    return [
      { name: 'My Dashboard', path: '/employee/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { name: 'Company Chat', path: '/employee/chat', icon: <MessageSquare className="w-4 h-4" /> },
      { name: 'Attendance History', path: '/employee/history', icon: <History className="w-4 h-4" /> },
      { name: 'Holidays', path: '/employee/holidays', icon: <CalendarDays className="w-4 h-4" /> },
      { name: 'Change Password', path: '/employee/change-password', icon: <KeyRound className="w-4 h-4" /> },
    ];
  };

  const navLinks = getNavLinks();

  const roleBadge = {
    SUPER_ADMIN: { label: 'Super Admin', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
    COMPANY_ADMIN: { label: 'Company Admin', bg: 'bg-brand-100 text-brand-800 border-brand-200' },
    EMPLOYEE: { label: 'Employee', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  }[user?.role || 'EMPLOYEE'];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-brand-900 text-white border-r border-brand-950 transition-all duration-200 flex flex-col ${
          collapsed ? 'w-20' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand / Logo Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-brand-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <h1 className="text-sm font-bold tracking-tight text-white leading-tight">{platformName}</h1>
                <p className="text-[10px] text-brand-300 font-medium tracking-wider uppercase">Enterprise SaaS</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-brand-300 hover:text-white lg:hidden p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Context Pill (if Company Admin or Employee) */}
        {company && !collapsed && (
          <div className="mx-4 mt-4 p-3 bg-brand-950/60 rounded-xl border border-brand-800/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Tenant</span>
              <span className="text-[10px] font-mono bg-brand-800/80 px-1.5 py-0.5 rounded text-brand-200 font-bold">
                {company.code}
              </span>
            </div>
            <p className="text-xs font-semibold text-white mt-1 truncate">{company.name}</p>
            <p className="text-[10px] text-brand-300 mt-0.5 truncate">{company.settings?.timezone || 'UTC'}</p>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-700/80 text-white shadow-sm font-semibold'
                    : 'text-brand-200 hover:text-white hover:bg-brand-800/60'
                }`}
                title={collapsed ? link.name : undefined}
              >
                <span className={isActive ? 'text-sky-300' : 'text-brand-300'}>{link.icon}</span>
                {!collapsed && <span>{link.name}</span>}
                {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-brand-300" />}
              </NavLink>
            );
          })}
        </nav>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-brand-800/80 bg-brand-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-800 border border-brand-700 flex items-center justify-center font-bold text-xs text-brand-100 flex-shrink-0">
              {user?.fullName.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.fullName}</p>
                <p className="text-[11px] text-brand-300 truncate">{user?.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-brand-400 hover:text-white p-1.5 rounded-lg hover:bg-brand-800/60 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-600 hover:text-slate-900 lg:hidden p-1.5 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 text-xs font-medium items-center gap-1.5"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Breadcrumb Context */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-900">{platformName}</span>
              <span>/</span>
              <span className="capitalize">{user?.role.toLowerCase().replace('_', ' ')}</span>
            </div>
          </div>

          {/* Right Header Status Badges */}
          <div className="flex items-center gap-3">
            {company && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold">{company.name}</span>
              </div>
            )}
            <div className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${roleBadge.bg}`}>
              {roleBadge.label}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
