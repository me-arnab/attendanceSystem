import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePlatformConfig } from '../../context/PlatformConfigContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Clock, Shield, Building2, UserCheck, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { platformName, systemAnnouncement } = usePlatformConfig();
  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();

  const enableDemoLogins = import.meta.env.VITE_ENABLE_DEMO_LOGINS === 'true';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toastError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await login({ email, password });
      toastSuccess(`Welcome back, ${response.user.fullName}!`);

      if (response.user.role === 'SUPER_ADMIN') {
        navigate('/super-admin/dashboard');
      } else if (response.user.role === 'COMPANY_ADMIN') {
        navigate('/company/dashboard');
      } else {
        navigate('/employee/dashboard');
      }
    } catch (err: any) {
      toastError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail: string, demoPass: string, roleName?: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    if (roleName) {
      toastSuccess(`${roleName} demo credentials populated.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-900 text-white shadow-md mb-3">
            <Clock className="w-7 h-7 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{platformName}</h1>
          <p className="text-sm text-slate-500 mt-1">Multi-Tenant Enterprise Attendance Management</p>

          {systemAnnouncement && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{systemAnnouncement}</span>
            </div>
          )}
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-slate-200">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Work Email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              Sign In to Portal
            </Button>
          </form>

          {/* Demo Login Section (Visible only when VITE_ENABLE_DEMO_LOGINS === 'true') */}
          {enableDemoLogins && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Demo Login
                  </span>
                  <span className="text-[11px] text-slate-400">
                    &bull; Quick Role Access
                  </span>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-medium border border-amber-200">
                  Development Mode
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Click any role to populate credentials, then click <strong>Sign In to Portal</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Super Admin Option */}
                <button
                  type="button"
                  onClick={() => fillCredentials('superadmin@saas.com', 'Admin@12345', 'Super Admin')}
                  className="flex sm:flex-col items-center sm:items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 hover:border-amber-300 text-left transition group shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Shield className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-slate-900 leading-tight">Super Admin</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">Platform Owner</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate mt-1">superadmin@saas.com</div>
                  </div>
                </button>

                {/* 2. Company Admin Option */}
                <button
                  type="button"
                  onClick={() => fillCredentials('admin@nexus.com', 'Nexus@12345', 'Company Admin')}
                  className="flex sm:flex-col items-center sm:items-start gap-2.5 p-3 rounded-xl border border-brand-200 bg-brand-50/50 hover:bg-brand-100/60 hover:border-brand-300 text-left transition group shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-100 border border-brand-200 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Building2 className="w-4 h-4 text-brand-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-slate-900 leading-tight">Company Admin</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">Nexus Global Admin</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate mt-1">admin@nexus.com</div>
                  </div>
                </button>

                {/* 3. Employee Option */}
                <button
                  type="button"
                  onClick={() => fillCredentials('john.doe@nexus.com', 'Emp@12345', 'Employee')}
                  className="flex sm:flex-col items-center sm:items-start gap-2.5 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 hover:border-emerald-300 text-left transition group shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-slate-900 leading-tight">Employee</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">John Doe (Staff)</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate mt-1">john.doe@nexus.com</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Security badge */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Multi-Tenant Isolation &bull; End-to-End Audit Logs &bull; RBAC Protected
        </p>
      </div>
    </div>
  );
};
