import React, { useEffect, useState, useMemo } from 'react';
import { companyService } from '../../services/companyService';
import { Holiday, HolidayType } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  getCompanyYearMonth,
  getCompanyTodayString,
  getLocalizedMonthOptions,
  getAvailableYears,
  formatDateInTimezone,
} from '../../utils/dateUtils';
import {
  CalendarDays,
  Plus,
  Search,
  ListFilter,
  Calendar,
  List,
  Edit2,
  Trash2,
  Repeat,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';

const HOLIDAY_TYPE_COLORS: Record<HolidayType, { bg: string; text: string; border: string }> = {
  NATIONAL: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  REGIONAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  COMPANY: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  OPTIONAL: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

export const HolidaysPage: React.FC = () => {
  const { company } = useAuth();
  const tz = company?.settings?.timezone;
  const { success, error } = useToast();

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Filters
  const currentYM = useMemo(() => getCompanyYearMonth(tz), [tz]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYM.year);
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or '01'..'12'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    isMultiDay: false,
    endDate: '',
    holidayType: 'COMPANY' as HolidayType,
    isRecurring: false,
  });

  const monthOptions = useMemo(() => getLocalizedMonthOptions(), []);
  const yearOptions = useMemo(() => getAvailableYears(selectedYear, 4, 3), [selectedYear]);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const monthNum = selectedMonth !== 'all' ? parseInt(selectedMonth, 10) : undefined;
      const res = await companyService.getHolidays({
        year: selectedYear,
        month: monthNum,
        search: searchQuery || undefined,
      });
      setHolidays(res);
    } catch (err: any) {
      error(err.message || 'Failed to load holidays.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [selectedYear, selectedMonth, searchQuery]);

  const handleOpenAdd = (defaultDate?: string) => {
    const today = getCompanyTodayString(tz);
    setEditingHoliday(null);
    setFormData({
      name: '',
      description: '',
      date: defaultDate || today,
      isMultiDay: false,
      endDate: defaultDate || today,
      holidayType: 'COMPANY',
      isRecurring: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    const hasMulti = Boolean(holiday.endDate && holiday.endDate !== holiday.date);
    setFormData({
      name: holiday.name,
      description: holiday.description || '',
      date: holiday.date,
      isMultiDay: hasMulti,
      endDate: holiday.endDate || holiday.date,
      holidayType: holiday.holidayType,
      isRecurring: holiday.isRecurring,
    });
    setModalOpen(true);
  };

  const handleOpenDelete = (holiday: Holiday) => {
    setDeletingHoliday(holiday);
    setDeleteConfirmOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      error('Holiday name and start date are required.');
      return;
    }

    if (formData.isMultiDay && formData.endDate && formData.endDate < formData.date) {
      error('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<Holiday> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        date: formData.date,
        endDate: formData.isMultiDay && formData.endDate ? formData.endDate : null,
        holidayType: formData.holidayType,
        isRecurring: formData.isRecurring,
      };

      if (editingHoliday) {
        await companyService.updateHoliday(editingHoliday._id || editingHoliday.id!, payload);
        success(`Holiday "${payload.name}" updated successfully.`);
      } else {
        await companyService.createHoliday(payload);
        success(`Holiday "${payload.name}" added successfully.`);
      }

      setModalOpen(false);
      loadHolidays();
    } catch (err: any) {
      error(err.message || 'Failed to save holiday.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingHoliday) return;
    setSubmitting(true);
    try {
      await companyService.deleteHoliday(deletingHoliday._id || deletingHoliday.id!);
      success(`Holiday "${deletingHoliday.name}" deleted successfully.`);
      setDeleteConfirmOpen(false);
      setDeletingHoliday(null);
      loadHolidays();
    } catch (err: any) {
      error(err.message || 'Failed to delete holiday.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for monthly calendar rendering
  const activeCalendarMonth = selectedMonth !== 'all' ? parseInt(selectedMonth, 10) : currentYM.month;
  const calendarDays = useMemo(() => {
    const year = selectedYear;
    const month = activeCalendarMonth - 1; // 0-indexed
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prefix days from previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      days.push({
        dateStr: `${prevDate.getFullYear()}-${mStr}-${dStr}`,
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dateStr: `${year}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Suffix days to complete grid to multiple of 7
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let r = 1; r <= remaining; r++) {
        const nextDate = new Date(year, month + 1, r);
        const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dStr = String(r).padStart(2, '0');
        days.push({
          dateStr: `${nextDate.getFullYear()}-${mStr}-${dStr}`,
          dayNum: r,
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [selectedYear, activeCalendarMonth]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of holidays) {
      const start = h.date;
      const end = h.endDate || h.date;

      // Map holiday to all dates in its span
      let cur = new Date(`${start}T00:00:00Z`);
      const endDateObj = new Date(`${end}T00:00:00Z`);

      while (cur <= endDateObj) {
        const dStr = cur.toISOString().substring(0, 10);
        if (!map.has(dStr)) {
          map.set(dStr, []);
        }
        map.get(dStr)!.push(h);
        cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    return map;
  }, [holidays]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Holidays"
        subtitle={`Manage official company holidays, recurring annual observances, and off-days (${holidays.length} configured for ${selectedYear}).`}
        actions={
          <Button onClick={() => handleOpenAdd()} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Holiday
          </Button>
        }
      />

      {/* Filter and View Toggle Card */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
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

            {/* Month Filter */}
            <div className="w-44">
              <Select
                label=""
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={String(m.value).padStart(2, '0')}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search holidays..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-end md:self-auto">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                viewMode === 'calendar'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List ({holidays.length})
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Loading company holidays..." />
      ) : holidays.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No Holidays Scheduled"
            description={`No holidays found for year ${selectedYear}${
              selectedMonth !== 'all' ? ` in ${monthOptions.find((m) => m.value === parseInt(selectedMonth, 10))?.label}` : ''
            }. Add official holidays to prevent employee absence counts.`}
            icon={<CalendarDays className="w-10 h-10 text-slate-400" />}
            actionText="Add First Holiday"
            onAction={() => handleOpenAdd()}
          />
        </Card>
      ) : viewMode === 'list' ? (
        /* List View */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Holiday Name</th>
                  <th className="py-3.5 px-6 font-semibold">Category</th>
                  <th className="py-3.5 px-6 font-semibold">Date Range</th>
                  <th className="py-3.5 px-6 font-semibold">Cadence</th>
                  <th className="py-3.5 px-6 font-semibold">Description</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holidays.map((h) => {
                  const style = HOLIDAY_TYPE_COLORS[h.holidayType] || HOLIDAY_TYPE_COLORS.COMPANY;
                  const isMulti = Boolean(h.endDate && h.endDate !== h.date);

                  return (
                    <tr key={h._id || h.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-slate-900">{h.name}</div>
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
                        >
                          {h.holidayType}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-mono text-xs text-slate-800 font-medium">
                          {h.date}
                          {isMulti && (
                            <span className="text-slate-500 font-normal"> to {h.endDate}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        {h.isRecurring ? (
                          <span className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded font-medium border border-brand-200">
                            <Repeat className="w-3 h-3" />
                            Annual
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">One-time</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-500 max-w-xs truncate">
                        {h.description || '--'}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(h)}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 transition"
                            title="Edit Holiday"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(h)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition"
                            title="Delete Holiday"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Calendar View */
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-brand-700" />
              <h3 className="font-bold text-slate-900 text-base">
                {monthOptions.find((m) => m.value === activeCalendarMonth)?.label} {selectedYear}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {Object.entries(HOLIDAY_TYPE_COLORS).map(([type, style]) => (
                <span
                  key={type}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border ${style.bg} ${style.text} ${style.border}`}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200 text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="bg-slate-50 py-2 text-center font-bold text-slate-600 uppercase tracking-wider text-[11px]"
              >
                {d}
              </div>
            ))}

            {calendarDays.map((cell) => {
              const dayHolidays = holidaysByDate.get(cell.dateStr) || [];
              const hasHoliday = dayHolidays.length > 0;
              const isToday = cell.dateStr === getCompanyTodayString(tz);

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    if (dayHolidays.length > 0) {
                      handleOpenEdit(dayHolidays[0]);
                    } else {
                      handleOpenAdd(cell.dateStr);
                    }
                  }}
                  className={`min-h-[90px] p-1.5 transition cursor-pointer flex flex-col justify-between ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/60 opacity-60'
                  } ${hasHoliday ? 'hover:bg-brand-50/40' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                        isToday
                          ? 'bg-brand-700 text-white font-bold'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {hasHoliday && (
                      <span className="text-[10px] text-brand-600 font-medium">Holiday</span>
                    )}
                  </div>

                  {/* Holiday Pills */}
                  <div className="space-y-1 my-1">
                    {dayHolidays.map((dh) => {
                      const style = HOLIDAY_TYPE_COLORS[dh.holidayType] || HOLIDAY_TYPE_COLORS.COMPANY;
                      return (
                        <div
                          key={dh._id || dh.id}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border truncate ${style.bg} ${style.text} ${style.border}`}
                          title={`${dh.name} (${dh.holidayType})`}
                        >
                          {dh.isRecurring && '🔁 '}
                          {dh.name}
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[9px] text-slate-300 text-right opacity-0 hover:opacity-100 transition">
                    + Click
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add / Edit Holiday Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingHoliday ? 'Edit Company Holiday' : 'Add Company Holiday'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Holiday Name"
            required
            placeholder="e.g. Independence Day, Annual Founder's Day"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Holiday Category"
              value={formData.holidayType}
              onChange={(e) => setFormData({ ...formData, holidayType: e.target.value as HolidayType })}
            >
              <option value="NATIONAL">National Holiday</option>
              <option value="REGIONAL">Regional Holiday</option>
              <option value="COMPANY">Company Official Holiday</option>
              <option value="OPTIONAL">Optional / Floating Holiday</option>
            </Select>

            <Input
              label="Start Date"
              type="date"
              required
              value={formData.date}
              onChange={(e) => {
                const newDate = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  date: newDate,
                  endDate: prev.isMultiDay ? (prev.endDate < newDate ? newDate : prev.endDate) : newDate,
                }));
              }}
            />
          </div>

          {/* Multi-day toggle */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={formData.isMultiDay}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isMultiDay: e.target.checked,
                    endDate: e.target.checked ? prev.endDate || prev.date : prev.date,
                  }))
                }
                className="w-4 h-4 rounded text-brand-700 border-slate-300 focus:ring-brand-700"
              />
              Multi-Day Holiday (Spans multiple dates)
            </label>

            {formData.isMultiDay && (
              <div className="mt-3 pl-6">
                <Input
                  label="End Date"
                  type="date"
                  required={formData.isMultiDay}
                  value={formData.endDate}
                  min={formData.date}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  helperText="Inclusive final date of the holiday period"
                />
              </div>
            )}
          </div>

          {/* Recurring Annual Cadence toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-4 h-4 rounded text-brand-700 border-slate-300 focus:ring-brand-700"
              />
              <span className="flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-brand-700" />
                Annual Recurring Holiday
              </span>
            </label>
            <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
              Automatically applies on this date every year without needing manual recreation.
              February 29 leap-day recurring holidays automatically resolve to February 28 in non-leap years.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Provide context or instructions for employees..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              {editingHoliday ? 'Save Changes' : 'Create Holiday'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Holiday"
        message={`Are you sure you want to delete the holiday "${deletingHoliday?.name}"? This action will remove it from the organization calendar and audit records.`}
        confirmText="Delete Holiday"
        variant="danger"
        isLoading={submitting}
      />
    </div>
  );
};
