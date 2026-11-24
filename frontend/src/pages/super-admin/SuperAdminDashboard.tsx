import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService, SuperAdminDashboardData } from '../../services/superAdminService';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Building2,
  CheckCircle2,
  XCircle,
  Users,
  CalendarCheck,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const SuperAdminDashboard: React.FC = () => {
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await superAdminService.getDashboardStats();
        setData(res);
      } catch (err) {
        console.error('Failed to load super admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading || !data) {
    return <LoadingSpinner message="Loading platform metrics..." />;
  }

  const { stats, monthlyGrowth, recentCompanies } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Platform Overview"
        subtitle="Multi-tenant health metrics, registered enterprise companies, and platform-wide activity."
        actions={
          <Button
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={() => navigate('/super-admin/companies/create')}
          >
            Register New Company
          </Button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Companies"
          value={stats.totalCompanies}
          icon={<Building2 className="w-5 h-5" />}
          color="brand"
          subtitle="Registered accounts"
        />
        <StatCard
          title="Active Companies"
          value={stats.activeCompanies}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          subtitle="Operational tenants"
        />
        <StatCard
          title="Suspended"
          value={stats.suspendedCompanies}
          icon={<XCircle className="w-5 h-5" />}
          color="rose"
          subtitle="Access restricted"
        />
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon={<Users className="w-5 h-5" />}
          color="slate"
          subtitle="Across all companies"
        />
        <StatCard
          title="Today's Attendance"
          value={stats.todayAttendance}
          icon={<CalendarCheck className="w-5 h-5" />}
          color="amber"
          subtitle="Platform check-ins"
        />
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Registration Growth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Company Registration Growth"
            subtitle="Monthly new enterprise company onboardings"
          />
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#38bdf8' }}
                />
                <Bar dataKey="companies" name="New Companies" fill="#1e466f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Platform Status Summary Card */}
        <Card>
          <CardHeader title="Tenant Distribution" subtitle="System operational status" />
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-800">Active Tenants</span>
              </div>
              <span className="text-sm font-bold text-emerald-700">{stats.activeCompanies}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50/60 border border-rose-100">
              <div className="flex items-center gap-2.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span className="text-sm font-medium text-slate-800">Suspended Tenants</span>
              </div>
              <span className="text-sm font-bold text-rose-700">{stats.suspendedCompanies}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-800">Total Workforce</span>
              </div>
              <span className="text-sm font-bold text-slate-900">{stats.totalEmployees}</span>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                className="w-full justify-center"
                size="sm"
                onClick={() => navigate('/super-admin/companies')}
              >
                View Full Companies Directory
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Companies Table */}
      <Card>
        <CardHeader
          title="Recently Registered Companies"
          subtitle="Latest client organizations added to the platform"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/super-admin/companies')}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              View All
            </Button>
          }
        />

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-y border-slate-200">
              <tr>
                <th className="py-3 px-6 font-semibold">Company</th>
                <th className="py-3 px-6 font-semibold">Code</th>
                <th className="py-3 px-6 font-semibold">Admin Contact</th>
                <th className="py-3 px-6 font-semibold">Employees</th>
                <th className="py-3 px-6 font-semibold">Status</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentCompanies.map((comp: any) => (
                <tr key={comp._id || comp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-6">
                    <div className="font-semibold text-slate-900">{comp.name}</div>
                    <div className="text-xs text-slate-400">{comp.email}</div>
                  </td>
                  <td className="py-3.5 px-6 font-mono text-xs font-bold text-brand-800">
                    {comp.code}
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="font-medium text-slate-800">{comp.admin?.fullName || 'N/A'}</div>
                    <div className="text-xs text-slate-400">{comp.admin?.email || 'N/A'}</div>
                  </td>
                  <td className="py-3.5 px-6 font-semibold text-slate-700">
                    {comp.employeeCount ?? 0}
                  </td>
                  <td className="py-3.5 px-6">
                    <StatusBadge status={comp.status} />
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/super-admin/companies/${comp._id || comp.id}`)}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
