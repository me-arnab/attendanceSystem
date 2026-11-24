import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyService, CompanyDashboardMetrics } from '../../services/companyService';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Percent,
  PlusCircle,
  FolderTree,
  ExternalLink,
  CalendarCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export const CompanyAdminDashboard: React.FC = () => {
  const [data, setData] = useState<CompanyDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { company } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await companyService.getDashboardMetrics();
        setData(res);
      } catch (err) {
        console.error('Failed to load company dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading || !data) {
    return <LoadingSpinner message="Loading company dashboard..." />;
  }

  const { stats, trend, departmentSummary, recentActivity } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${company?.name || 'Company'} Dashboard`}
        subtitle={`Live attendance statistics for ${stats.todayDate} (${company?.settings?.timezone || 'UTC'})`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<CalendarCheck className="w-4 h-4" />}
              onClick={() => navigate('/company/attendance')}
            >
              Today's Attendance
            </Button>
            <Button
              icon={<PlusCircle className="w-4 h-4" />}
              onClick={() => navigate('/company/employees')}
            >
              Add Employee
            </Button>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon={<Users className="w-5 h-5" />}
          color="brand"
          subtitle="Active workforce"
        />
        <StatCard
          title="Present Today"
          value={stats.presentToday}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          subtitle="On-time arrivals"
        />
        <StatCard
          title="Late Today"
          value={stats.lateToday}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          subtitle={`> ${company?.settings?.lateThresholdMinutes || 15}m after shift`}
        />
        <StatCard
          title="Absent Today"
          value={stats.absentToday}
          icon={<UserX className="w-5 h-5" />}
          color="rose"
          subtitle="Unlogged employees"
        />
        <StatCard
          title="Attendance Rate"
          value={`${stats.attendanceRate}%`}
          icon={<Percent className="w-5 h-5" />}
          color="slate"
          trend={{
            value: `${stats.presentToday + stats.lateToday} / ${stats.totalEmployees}`,
            label: 'checked in',
            isPositive: stats.attendanceRate >= 80,
          }}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Attendance Trend */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="7-Day Attendance Trend"
            subtitle="Daily breakdown of Present, Late, and Absent staff"
          />
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="present" name="Present" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Department Summary */}
        <Card>
          <CardHeader
            title="Department Staffing"
            subtitle="Employee headcount by unit"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/company/departments')}
                icon={<FolderTree className="w-3.5 h-3.5" />}
              >
                Manage
              </Button>
            }
          />
          <div className="space-y-3 pt-1">
            {departmentSummary.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No departments created yet.</p>
            ) : (
              departmentSummary.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition"
                >
                  <span className="text-sm font-semibold text-slate-800">{dept.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                      {dept.employeeCount}
                    </span>
                    <span className="text-[11px] text-slate-500">members</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Live Recent Attendance Activity */}
      <Card>
        <CardHeader
          title="Recent Attendance Activity"
          subtitle="Real-time employee check-in and check-out records"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/company/attendance')}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              View All Logs
            </Button>
          }
        />

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-y border-slate-200">
              <tr>
                <th className="py-3 px-6 font-semibold">Employee</th>
                <th className="py-3 px-6 font-semibold">Date</th>
                <th className="py-3 px-6 font-semibold">Check In</th>
                <th className="py-3 px-6 font-semibold">Check Out</th>
                <th className="py-3 px-6 font-semibold">Duration</th>
                <th className="py-3 px-6 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                    No attendance records logged today yet.
                  </td>
                </tr>
              ) : (
                recentActivity.map((rec: any) => {
                  const emp = rec.employeeId;
                  const checkInFormatted = rec.checkIn
                    ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                  const checkOutFormatted = rec.checkOut
                    ? new Date(rec.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--';

                  const durationHours = (rec.workingMinutes / 60).toFixed(1);

                  return (
                    <tr key={rec._id || rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-slate-900">{emp?.fullName || 'Deleted Employee'}</div>
                        <div className="text-xs text-slate-400">
                          {emp?.employeeId ? `ID: ${emp.employeeId}` : emp?.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-600">{rec.date}</td>
                      <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-800">
                        {checkInFormatted}
                      </td>
                      <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-800">
                        {checkOutFormatted}
                      </td>
                      <td className="py-3.5 px-6 text-xs font-medium text-slate-700">
                        {rec.workingMinutes > 0 ? `${durationHours} hrs` : '--'}
                      </td>
                      <td className="py-3.5 px-6">
                        <StatusBadge status={rec.status} />
                        {rec.isManualCorrection && (
                          <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            Corrected
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
