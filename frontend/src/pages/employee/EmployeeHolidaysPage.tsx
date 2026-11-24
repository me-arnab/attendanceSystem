import React, { useEffect, useState, useMemo } from 'react';
import { employeeService } from '../../services/employeeService';
import { Holiday, HolidayType } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  getCompanyYearMonth,
  getCompanyTodayString,
  getAvailableYears,
  formatDateInTimezone,
} from '../../utils/dateUtils';
import {
  CalendarDays,
  Sparkles,
  Calendar,
  Repeat,
  Search,
  Clock,
  PartyPopper,
  CheckCircle2,
} from 'lucide-react';

const HOLIDAY_TYPE_STYLES: Record<HolidayType, { bg: string; text: string; border: string }> = {
  NATIONAL: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  REGIONAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  COMPANY: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  OPTIONAL: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

export const EmployeeHolidaysPage: React.FC = () => {
  const { company } = useAuth();
  const tz = company?.settings?.timezone;
  const { error } = useToast();

  const [upcoming, setUpcoming] = useState<Holiday[]>([]);
  const [yearHolidays, setYearHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYM = useMemo(() => getCompanyYearMonth(tz), [tz]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYM.year);
  const [searchQuery, setSearchQuery] = useState('');

  const yearOptions = useMemo(() => getAvailableYears(selectedYear, 3, 2), [selectedYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [upRes, yearRes] = await Promise.all([
        employeeService.getUpcomingHolidays(),
        employeeService.getHolidays({ year: selectedYear, search: searchQuery || undefined }),
      ]);
      setUpcoming(upRes);
      setYearHolidays(yearRes);
    } catch (err: any) {
      error(err.message || 'Failed to fetch holiday schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, searchQuery]);

  const todayStr = getCompanyTodayString(tz);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Holidays"
        subtitle="Official paid holidays, public observances, and mandatory company off-days."
      />

      {loading ? (
        <LoadingSpinner message="Loading holiday calendar..." />
      ) : (
        <>
          {/* Upcoming Holidays Showcase Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-brand-700" />
              <h3 className="font-bold text-slate-900 text-base">Upcoming Holidays</h3>
            </div>

            {upcoming.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-500">No upcoming holidays scheduled for the remainder of this cycle.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {upcoming.map((h) => {
                  const style = HOLIDAY_TYPE_STYLES[h.holidayType] || HOLIDAY_TYPE_STYLES.COMPANY;
                  const isMulti = Boolean(h.endDate && h.endDate !== h.date);

                  // Days remaining calculation
                  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
                  const targetMs = new Date(`${h.date}T00:00:00Z`).getTime();
                  const daysDiff = Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));

                  let countdownText = `${daysDiff} days away`;
                  if (daysDiff === 0) countdownText = 'Today!';
                  else if (daysDiff === 1) countdownText = 'Tomorrow';

                  return (
                    <Card
                      key={h._id || h.id}
                      className="border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style.bg} ${style.text} ${style.border}`}
                        >
                          {h.holidayType}
                        </span>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            daysDiff <= 3
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {countdownText}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-base leading-snug">{h.name}</h4>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateInTimezone(h.date, tz)}</span>
                        {isMulti && <span> - {formatDateInTimezone(h.endDate || h.date, tz)}</span>}
                      </div>

                      {h.description && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">{h.description}</p>
                      )}

                      {h.isRecurring && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] text-brand-600 font-medium">
                          <Repeat className="w-3 h-3" />
                          <span>Annual Recurring Holiday</span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Full Annual Schedule Section */}
          <div className="space-y-3 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-brand-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  Annual Schedule ({selectedYear})
                </h3>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-32">
                  <Select
                    label=""
                    value={String(selectedYear)}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={String(y)}>
                        Year {y}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search annual list..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            {yearHolidays.length === 0 ? (
              <Card className="p-8">
                <EmptyState
                  title="No holidays found"
                  description={`No holiday observances are listed for ${selectedYear}.`}
                  icon={<Calendar className="w-8 h-8 text-slate-400" />}
                />
              </Card>
            ) : (
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-6 font-semibold">Date</th>
                        <th className="py-3 px-6 font-semibold">Holiday Name</th>
                        <th className="py-3 px-6 font-semibold">Type</th>
                        <th className="py-3 px-6 font-semibold">Cadence</th>
                        <th className="py-3 px-6 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {yearHolidays.map((h) => {
                        const style = HOLIDAY_TYPE_STYLES[h.holidayType] || HOLIDAY_TYPE_STYLES.COMPANY;
                        const isMulti = Boolean(h.endDate && h.endDate !== h.date);

                        return (
                          <tr key={h._id || h.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-6 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                              {formatDateInTimezone(h.date, tz)}
                              {isMulti && (
                                <span className="text-slate-500 font-normal">
                                  {' '}
                                  to {formatDateInTimezone(h.endDate || h.date, tz)}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 font-semibold text-slate-900">
                              {h.name}
                            </td>
                            <td className="py-3.5 px-6">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
                              >
                                {h.holidayType}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-xs text-slate-500">
                              {h.isRecurring ? (
                                <span className="inline-flex items-center gap-1 text-brand-700 font-medium">
                                  <Repeat className="w-3 h-3" />
                                  Annual
                                </span>
                              ) : (
                                'One-time'
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-xs text-slate-500 max-w-sm">
                              {h.description || '--'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
};
