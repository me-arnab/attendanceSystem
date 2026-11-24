import React, { useEffect, useState } from 'react';
import { employeeService, EmployeeDashboardData } from '../../services/employeeService';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  Clock,
  CheckCircle2,
  CalendarCheck,
  AlertCircle,
  Percent,
  LogOut,
  Sparkles,
  Calendar,
  Hourglass,
  Building,
} from 'lucide-react';

export const EmployeeDashboard: React.FC = () => {
  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const loadDashboard = async () => {
    try {
      const res = await employeeService.getDashboard();
      setData(res);
    } catch (err: any) {
      toastError(err.message || 'Failed to load employee dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const updatedRecord = await employeeService.checkIn();
      success(
        `Successfully checked in at ${new Date(updatedRecord.checkIn!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}!`
      );
      await loadDashboard();
    } catch (err: any) {
      toastError(err.message || 'Check-in failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const updatedRecord = await employeeService.checkOut();
      success(
        `Successfully checked out at ${new Date(updatedRecord.checkOut!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}!`
      );
      await loadDashboard();
    } catch (err: any) {
      toastError(err.message || 'Check-out failed.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading || !data) {
    return <LoadingSpinner message="Loading employee self-service portal..." />;
  }

  const { employee, company, today, monthlyStats, recentHistory, monthlyRecords } = data;
  const todayAtt = today.attendance;
  const mode = company.attendanceMode || 'AUTO_ON_LOGIN';

  const checkInFormatted = todayAtt?.checkIn
    ? new Date(todayAtt.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const checkOutFormatted = todayAtt?.checkOut
    ? new Date(todayAtt.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const canCheckOut = !!todayAtt && !todayAtt.checkOut;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-900 to-brand-800 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {mode === 'AUTO_ON_LOGIN' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-800/80 text-[11px] font-semibold text-sky-300 mb-2 border border-brand-700">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Attendance Logged Automatically</span>
            </div>
          )}
          {mode === 'MANUAL_PUNCH' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-900/80 text-[11px] font-semibold text-amber-300 mb-2 border border-amber-700">
              <Clock className="w-3.5 h-3.5" />
              <span>Manual Punch Policy Active</span>
            </div>
          )}
          {mode === 'DISABLED' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 text-[11px] font-semibold text-slate-300 mb-2 border border-slate-700">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Attendance Tracking Disabled by Company</span>
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome back, {employee.fullName}!
          </h1>
          <p className="text-xs text-brand-200 mt-1">
            {employee.designation || 'Staff Member'} &bull; {company.name} ({company.code}) &bull;{' '}
            {today.date}
          </p>
        </div>

        {/* Live Status Widget */}
        <div className="bg-brand-950/70 p-4 rounded-xl border border-brand-700/60 flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-brand-300">
              Today's Status
            </div>
            <div className="mt-1 flex items-center gap-2">
              {mode === 'DISABLED' ? (
                <span className="text-xs text-slate-400 italic">Tracking Disabled</span>
              ) : todayAtt ? (
                <StatusBadge status={todayAtt.status} />
              ) : (
                <span className="text-xs text-slate-300">Not recorded</span>
              )}
            </div>
          </div>

          {/* Mode-specific punch actions */}
          {mode === 'MANUAL_PUNCH' && !todayAtt && (
            <Button
              variant="outline"
              size="sm"
              className="bg-emerald-500 text-white hover:bg-emerald-600 font-semibold border-emerald-400"
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              onClick={handleCheckIn}
              isLoading={checkingIn}
            >
              Check In Now
            </Button>
          )}

          {mode !== 'DISABLED' && canCheckOut && (
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-brand-900 hover:bg-slate-100 font-semibold"
              icon={<LogOut className="w-3.5 h-3.5 text-brand-700" />}
              onClick={handleCheckOut}
              isLoading={checkingOut}
            >
              Check Out Now
            </Button>
          )}

          {mode !== 'DISABLED' && todayAtt?.checkOut && (
            <div className="text-xs text-emerald-300 font-medium">Checked Out</div>
          )}
        </div>
      </div>

      {/* Today's Punch Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Check In</span>
            <h3 className="text-xl font-mono font-bold text-slate-900 mt-0.5">{checkInFormatted}</h3>
            <p className="text-[11px] text-slate-500">Scheduled: {company.officeStartTime}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Check Out</span>
            <h3 className="text-xl font-mono font-bold text-slate-900 mt-0.5">{checkOutFormatted}</h3>
            <p className="text-[11px] text-slate-500">Scheduled: {company.officeEndTime}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Hourglass className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Worked Today</span>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {todayAtt?.workingMinutes ? (todayAtt.workingMinutes / 60).toFixed(1) : '0'} hrs
            </h3>
            <p className="text-[11px] text-slate-500">Current shift duration</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Timezone</span>
            <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">{company.timezone}</h3>
            <p className="text-[11px] text-slate-500">Company shift standard</p>
          </div>
        </Card>
      </div>

      {/* Monthly Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Present"
          value={`${monthlyStats.presentDays} days`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          subtitle={`${monthlyStats.month}`}
        />
        <StatCard
          title="Monthly Late"
          value={`${monthlyStats.lateDays} days`}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          subtitle="Late arrivals"
        />
        <StatCard
          title="Monthly Absent"
          value={`${monthlyStats.absentDays} days`}
          icon={<AlertCircle className="w-5 h-5" />}
          color="rose"
          subtitle="Unlogged days"
        />
        <StatCard
          title="Attendance Rate"
          value={`${monthlyStats.attendancePercentage}%`}
          icon={<Percent className="w-5 h-5" />}
          color="brand"
          subtitle={`${monthlyStats.attendedDays} / ${monthlyStats.totalLoggedDays} days`}
        />
      </div>

      {/* Calendar Grid & Recent Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Calendar Visualizer */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Monthly Calendar"
            subtitle={`Overview of ${monthlyStats.month}`}
          />
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs pt-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d} className="font-semibold text-slate-400 py-1">
                {d}
              </span>
            ))}
            {monthlyRecords.map((r) => {
              const dayNum = parseInt(r.date.split('-')[2], 10);
              const color = {
                PRESENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                LATE: 'bg-amber-100 text-amber-800 border-amber-200',
                ABSENT: 'bg-rose-100 text-rose-800 border-rose-200',
                INCOMPLETE: 'bg-sky-100 text-sky-800 border-sky-200',
              }[r.status];

              return (
                <div
                  key={r._id}
                  className={`p-2 rounded-lg border flex flex-col items-center justify-center font-semibold text-xs ${color}`}
                  title={`${r.date}: ${r.status}`}
                >
                  <span>{dayNum}</span>
                  <span className="text-[9px] uppercase tracking-tighter opacity-80 mt-0.5">
                    {r.status.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Attendance History Table */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Attendance Activity"
            subtitle="Your latest 10 daily check-ins and verified clock-out timestamps"
          />

          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-y border-slate-200">
                <tr>
                  <th className="py-3 px-6 font-semibold">Date</th>
                  <th className="py-3 px-6 font-semibold">Check In</th>
                  <th className="py-3 px-6 font-semibold">Check Out</th>
                  <th className="py-3 px-6 font-semibold">Working Hours</th>
                  <th className="py-3 px-6 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-500">
                      No past attendance history available.
                    </td>
                  </tr>
                ) : (
                  recentHistory.map((rec) => {
                    const checkIn = rec.checkIn
                      ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--';
                    const checkOut = rec.checkOut
                      ? new Date(rec.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--';
                    const hrs = (rec.workingMinutes / 60).toFixed(1);

                    return (
                      <tr key={rec._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-6 text-xs font-semibold text-slate-800">{rec.date}</td>
                        <td className="py-3 px-6 text-xs font-mono text-slate-700">{checkIn}</td>
                        <td className="py-3 px-6 text-xs font-mono text-slate-700">{checkOut}</td>
                        <td className="py-3 px-6 text-xs font-semibold text-slate-900">
                          {rec.workingMinutes > 0 ? `${hrs} hrs` : '--'}
                        </td>
                        <td className="py-3 px-6">
                          <StatusBadge status={rec.status} />
                          {rec.isManualCorrection && (
                            <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">
                              Adjusted
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
    </div>
  );
};
