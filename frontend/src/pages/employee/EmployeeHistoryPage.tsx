import React, { useEffect, useState } from 'react';
import { employeeService, EmployeeHistoryResponse } from '../../services/employeeService';
import { Attendance } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  getCompanyYearMonth,
  getLocalizedMonthOptions,
  getAvailableYears,
  formatTimeInTimezone,
} from '../../utils/dateUtils';
import { History, Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export const EmployeeHistoryPage: React.FC = () => {
  const { company } = useAuth();
  const tz = company?.settings?.timezone;

  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const ym = getCompanyYearMonth(tz);
    return String(ym.month).padStart(2, '0');
  });
  const [year, setYear] = useState(() => {
    const ym = getCompanyYearMonth(tz);
    return String(ym.year);
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const monthOptions = React.useMemo(() => getLocalizedMonthOptions(), []);
  const yearOptions = React.useMemo(() => getAvailableYears(parseInt(year, 10)), [year]);

  const { error } = useToast();

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await employeeService.getAttendanceHistory({
        month,
        year,
        page,
        limit: 31,
      });
      setRecords(res.records);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      error(err.message || 'Failed to fetch personal attendance history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [month, year, page]);

  const totalWorkedMinutes = records.reduce((acc, r) => acc + (r.workingMinutes || 0), 0);
  const totalHours = (totalWorkedMinutes / 60).toFixed(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Attendance History"
        subtitle={`Timesheet and check-in audit records (${totalCount} days recorded)`}
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-44">
              <Select label="Filter Month" value={month} onChange={(e) => setMonth(e.target.value)}>
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
            <div className="w-28">
              <Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs">
            <Clock className="w-4 h-4 text-brand-700" />
            <span className="text-slate-500">Total Worked in Period:</span>
            <span className="font-bold text-slate-900">{totalHours} hrs</span>
          </div>
        </div>
      </Card>

      {/* Records Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading attendance records..." />
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No records found"
              description="No attendance records found for the selected month and year."
              icon={<History className="w-8 h-8 text-slate-400" />}
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6 font-semibold">Date</th>
                    <th className="py-3 px-6 font-semibold">Check In</th>
                    <th className="py-3 px-6 font-semibold">Check Out</th>
                    <th className="py-3 px-6 font-semibold">Working Hours</th>
                    <th className="py-3 px-6 font-semibold">Status</th>
                    <th className="py-3 px-6 font-semibold">Correction Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => {
                    const checkIn = r.checkIn
                      ? formatTimeInTimezone(r.checkIn, tz)
                      : '--:--';
                    const checkOut = r.checkOut
                      ? formatTimeInTimezone(r.checkOut, tz)
                      : '--:--';
                    const durationHours = (r.workingMinutes / 60).toFixed(1);

                    return (
                      <tr key={r._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-6 text-xs font-semibold text-slate-800">{r.date}</td>
                        <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-800">
                          {checkIn}
                        </td>
                        <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-800">
                          {checkOut}
                        </td>
                        <td className="py-3.5 px-6 text-xs font-semibold text-slate-900">
                          {r.workingMinutes > 0 ? `${durationHours} hrs` : '--'}
                        </td>
                        <td className="py-3.5 px-6">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3.5 px-6 text-xs text-slate-500">
                          {r.isManualCorrection ? (
                            <div>
                              <span className="font-semibold text-amber-700">Manually Adjusted</span>
                              {r.correctionReason && (
                                <p className="text-[11px] text-slate-400 italic">"{r.correctionReason}"</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Standard Login Punch</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination if needed */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    icon={<ChevronLeft className="w-3.5 h-3.5" />}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    icon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
