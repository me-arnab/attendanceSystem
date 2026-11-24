import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePlatformConfig } from '../../context/PlatformConfigContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Clock, Shield, Building, UserCheck, AlertCircle } from 'lucide-react';

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

  const fillCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
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

          {/* Quick Demo Credentials helper (Only visible when VITE_ENABLE_DEMO_LOGINS is 'true') */}
          {enableDemoLogins && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  1-Click Demo Logins
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-medium">
                  Development Mode
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => fillCredentials('superadmin@saas.com', 'Admin@12345')}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition"
                >
                  <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-slate-800">Super Admin</div>
                    <div className="text-[11px] text-slate-500 truncate">Platform Owner</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials('admin@nexus.com', 'Nexus@12345')}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition"
                >
                  <Building className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-slate-800">Nexus Admin</div>
                    <div className="text-[11px] text-slate-500 truncate">Company 1</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials('admin@apex.com', 'Apex@12345')}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition"
                >
                  <Building className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-slate-800">Apex Admin</div>
                    <div className="text-[11px] text-slate-500 truncate">Company 2</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials('john.doe@nexus.com', 'Emp@12345')}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition"
                >
                  <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-slate-800">Nexus Employee</div>
                    <div className="text-[11px] text-slate-500 truncate">John Doe</div>
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
