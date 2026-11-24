import React, { useEffect, useState } from 'react';
import { companyService, ReportsResponse } from '../../services/companyService';
import { Department, User } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  getCompanyTodayString,
  getCompanyYearMonth,
  getLocalizedMonthOptions,
  getAvailableYears,
  formatTimeInTimezone,
} from '../../utils/dateUtils';
import {
  FileBarChart,
  Calendar,
  CheckCircle2,
  Clock,
  UserX,
  Hourglass,
  Download,
  Filter,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { company } = useAuth();
  const tz = company?.settings?.timezone;

  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [date, setDate] = useState(() => getCompanyTodayString(tz));
  const [month, setMonth] = useState(() => {
    const ym = getCompanyYearMonth(tz);
    return String(ym.month).padStart(2, '0');
  });
  const [year, setYear] = useState(() => {
    const ym = getCompanyYearMonth(tz);
    return String(ym.year);
  });
  const [departmentId, setDepartmentId] = useState('all');

  const monthOptions = React.useMemo(() => getLocalizedMonthOptions(), []);
  const yearOptions = React.useMemo(() => getAvailableYears(parseInt(year, 10)), [year]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const { error } = useToast();

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await companyService.getReports({
        type: reportType,
        date: reportType === 'daily' ? date : undefined,
        month: reportType === 'monthly' ? month : undefined,
        year: reportType === 'monthly' ? year : undefined,
        departmentId: departmentId !== 'all' ? departmentId : undefined,
      });
      setData(res);
    } catch (err: any) {
      error(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    companyService.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    loadReport();
  }, [reportType, date, month, year, departmentId]);

  const exportCSV = () => {
    if (!data || data.records.length === 0) return;

    const headers = ['Employee Name', 'Employee ID', 'Department', 'Date', 'Status', 'Check In', 'Check Out', 'Working Hours'];
    const rows = data.records.map((r: any) => [
      r.employeeId?.fullName || '',
      r.employeeId?.employeeId || '',
      r.employeeId?.departmentId?.name || '',
      r.date,
      r.status,
      r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '',
      r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '',
      (r.workingMinutes / 60).toFixed(1),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${reportType}_${date || `${year}-${month}`}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Reports"
        subtitle="Generate daily and monthly aggregated timesheets, attendance trends, and departmental compliance."
        actions={
          <Button
            variant="outline"
            icon={<Download className="w-4 h-4" />}
            onClick={exportCSV}
            disabled={!data || data.records.length === 0}
          >
            Export to CSV
          </Button>
        }
      />

      {/* Report Filter Controls */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Select
              label="Report Period"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
            >
              <option value="daily">Daily Attendance Report</option>
              <option value="monthly">Monthly Aggregate Report</option>
            </Select>
          </div>

          {reportType === 'daily' ? (
            <div>
              <Input
                label="Target Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <Select label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
                  {monthOptions.map((m) => {
                    const mVal = String(m.value).padStart(2, '0');
                    return (
                      <option key={mVal} value={mVal}>
                        {m.label}
                      </option>
                    );
                  })}
                </Select>
              </div>
              <div>
                <Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          <div>
            <Select
              label="Department Filter"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Summary KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title="Total Logs"
            value={data.summary.totalRecords}
            icon={<FileBarChart className="w-4 h-4" />}
            color="brand"
          />
          <StatCard
            title="Present"
            value={data.summary.presentCount}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="emerald"
          />
          <StatCard
            title="Late"
            value={data.summary.lateCount}
            icon={<Clock className="w-4 h-4" />}
            color="amber"
          />
          <StatCard
            title="Absent"
            value={data.summary.absentCount}
            icon={<UserX className="w-4 h-4" />}
            color="rose"
          />
          <StatCard
            title="Incomplete"
            value={data.summary.incompleteCount}
            icon={<Hourglass className="w-4 h-4" />}
            color="slate"
          />
          <StatCard
            title="Avg Working"
            value={`${data.summary.avgWorkingHours}h`}
            icon={<Clock className="w-4 h-4" />}
            color="brand"
          />
        </div>
      )}

      {/* Table Records */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Generating timesheet report..." />
        ) : !data || data.records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No records found for this period"
              description="Try selecting a different date or departmental filter."
              icon={<Calendar className="w-8 h-8 text-slate-400" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6 font-semibold">Employee</th>
                  <th className="py-3 px-6 font-semibold">Department</th>
                  <th className="py-3 px-6 font-semibold">Date</th>
                  <th className="py-3 px-6 font-semibold">Check In</th>
                  <th className="py-3 px-6 font-semibold">Check Out</th>
                  <th className="py-3 px-6 font-semibold">Hours</th>
                  <th className="py-3 px-6 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.records.map((r: any) => {
                  const emp = r.employeeId;
                  const checkInFormatted = r.checkIn
                    ? formatTimeInTimezone(r.checkIn, tz)
                    : '--:--';
                  const checkOutFormatted = r.checkOut
                    ? formatTimeInTimezone(r.checkOut, tz)
                    : '--:--';
                  const durationHours = (r.workingMinutes / 60).toFixed(1);

                  return (
                    <tr key={r._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        {emp?.fullName || 'Deleted Employee'}
                        <div className="text-xs text-slate-400 font-normal">{emp?.employeeId}</div>
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-600 font-medium">
                        {emp?.departmentId?.name || '--'}
                      </td>
                      <td className="py-3.5 px-6 text-xs font-medium text-slate-800">{r.date}</td>
                      <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-700">
                        {checkInFormatted}
                      </td>
                      <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-700">
                        {checkOutFormatted}
                      </td>
                      <td className="py-3.5 px-6 text-xs font-semibold text-slate-900">
                        {r.workingMinutes > 0 ? `${durationHours} hrs` : '--'}
                      </td>
                      <td className="py-3.5 px-6">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
