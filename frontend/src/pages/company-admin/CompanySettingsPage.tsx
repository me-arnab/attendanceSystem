import React, { useEffect, useState, useMemo } from 'react';
import { companyService } from '../../services/companyService';
import { Company, AttendanceMode } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Building2, Clock, Globe, ShieldCheck, Settings2, Sliders, Search } from 'lucide-react';
import { getSupportedTimezones } from '../../utils/timezone';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const CompanySettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const { refreshUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    code: '',
    timezone: 'UTC',
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    lateThresholdMinutes: 15,
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    attendanceMode: 'AUTO_ON_LOGIN' as AttendanceMode,
    requireCheckOut: true,
    breakDurationMinutes: 0,
    halfDayThresholdHours: 4,
    overtimeThresholdHours: 9,
    autoCheckoutHoursAfterEnd: 2,
  });

  const allTimezones = useMemo(() => getSupportedTimezones(formData.timezone), [formData.timezone]);

  const filteredTimezones = useMemo(() => {
    if (!timezoneSearch.trim()) return allTimezones;
    const q = timezoneSearch.toLowerCase();
    const matches = allTimezones.filter((tz) => tz.toLowerCase().includes(q));
    // Ensure selected timezone is always available in options
    if (formData.timezone && !matches.includes(formData.timezone)) {
      return [formData.timezone, ...matches];
    }
    return matches;
  }, [allTimezones, timezoneSearch, formData.timezone]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const comp = await companyService.getSettings();
        setFormData({
          name: comp.name || '',
          email: comp.email || '',
          phone: comp.phone || '',
          address: comp.address || '',
          code: comp.code || '',
          timezone: comp.settings?.timezone || 'UTC',
          officeStartTime: comp.settings?.officeStartTime || '09:00',
          officeEndTime: comp.settings?.officeEndTime || '18:00',
          lateThresholdMinutes: comp.settings?.lateThresholdMinutes ?? 15,
          workingDays: comp.settings?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          attendanceMode: comp.settings?.attendanceMode || 'AUTO_ON_LOGIN',
          requireCheckOut: comp.settings?.requireCheckOut ?? true,
          breakDurationMinutes: comp.settings?.breakDurationMinutes ?? 0,
          halfDayThresholdHours: comp.settings?.halfDayThresholdHours ?? 4,
          overtimeThresholdHours: comp.settings?.overtimeThresholdHours ?? 9,
          autoCheckoutHoursAfterEnd: comp.settings?.autoCheckoutHoursAfterEnd ?? 2,
        });
      } catch (err: any) {
        toastError(err.message || 'Failed to load company settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleWorkingDaysToggle = (day: string) => {
    setFormData((prev) => {
      const exists = prev.workingDays.includes(day);
      return {
        ...prev,
        workingDays: exists
          ? prev.workingDays.filter((d) => d !== day)
          : [...prev.workingDays, day],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toastError('Company name and email are required.');
      return;
    }

    setSaving(true);
    try {
      await companyService.updateSettings({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        settings: {
          timezone: formData.timezone,
          officeStartTime: formData.officeStartTime,
          officeEndTime: formData.officeEndTime,
          lateThresholdMinutes: Number(formData.lateThresholdMinutes),
          workingDays: formData.workingDays,
          attendanceMode: formData.attendanceMode,
          requireCheckOut: formData.requireCheckOut,
          breakDurationMinutes: Number(formData.breakDurationMinutes),
          halfDayThresholdHours: Number(formData.halfDayThresholdHours),
          overtimeThresholdHours: Number(formData.overtimeThresholdHours),
          autoCheckoutHoursAfterEnd: Number(formData.autoCheckoutHoursAfterEnd),
        },
      });

      await refreshUser();
      success('Company settings updated successfully.');
    } catch (err: any) {
      toastError(err.message || 'Failed to update company settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading company settings..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Company Settings"
        subtitle="Manage your company profile, timezone, shift schedules, and attendance policy."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Card */}
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-brand-700" />
            <h3 className="text-base font-semibold text-slate-900">Organization Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Company Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <Input
              label="Company Tenant Code (Immutable)"
              value={formData.code}
              disabled
              helperText="Assigned by platform Super Admin"
            />

            <Input
              label="Contact Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <div className="sm:col-span-2">
              <Input
                label="Physical Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Attendance Policy Mode Card */}
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Settings2 className="w-5 h-5 text-brand-700" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Attendance Policy Mode</h3>
              <p className="text-xs text-slate-500">
                Choose how employee attendance is tracked and recorded for your organization.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition ${
                  formData.attendanceMode === 'AUTO_ON_LOGIN'
                    ? 'border-brand-700 bg-brand-50/50 ring-2 ring-brand-700/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="attendanceMode"
                  value="AUTO_ON_LOGIN"
                  checked={formData.attendanceMode === 'AUTO_ON_LOGIN'}
                  onChange={() => setFormData({ ...formData, attendanceMode: 'AUTO_ON_LOGIN' })}
                  className="sr-only"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-brand-900">
                  Auto on Login
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Employees are automatically checked in upon daily login during working days.
                </span>
              </label>

              <label
                className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition ${
                  formData.attendanceMode === 'MANUAL_PUNCH'
                    ? 'border-brand-700 bg-brand-50/50 ring-2 ring-brand-700/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="attendanceMode"
                  value="MANUAL_PUNCH"
                  checked={formData.attendanceMode === 'MANUAL_PUNCH'}
                  onChange={() => setFormData({ ...formData, attendanceMode: 'MANUAL_PUNCH' })}
                  className="sr-only"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-brand-900">
                  Manual Punch
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Employees must explicitly punch in and out using dedicated dashboard buttons.
                </span>
              </label>

              <label
                className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition ${
                  formData.attendanceMode === 'DISABLED'
                    ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="attendanceMode"
                  value="DISABLED"
                  checked={formData.attendanceMode === 'DISABLED'}
                  onChange={() => setFormData({ ...formData, attendanceMode: 'DISABLED' })}
                  className="sr-only"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                  Disabled
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Attendance tracking is disabled. No automated or manual attendance records are created.
                </span>
              </label>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="requireCheckOut"
                checked={formData.requireCheckOut}
                onChange={(e) => setFormData({ ...formData, requireCheckOut: e.target.checked })}
                className="w-4 h-4 rounded text-brand-700 border-slate-300 focus:ring-brand-700"
              />
              <label htmlFor="requireCheckOut" className="text-xs font-medium text-slate-700 cursor-pointer">
                Enforce Mandatory Employee Check-Out (Flags unclosed shifts as Incomplete)
              </label>
            </div>
          </div>
        </Card>

        {/* Shift & Timezone Policies */}
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Clock className="w-5 h-5 text-brand-700" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Shift Schedule & Timezone</h3>
              <p className="text-xs text-slate-500">
                These settings govern working hours, late detection, and time calculations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Company Timezone</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search timezone..."
                    value={timezoneSearch}
                    onChange={(e) => setTimezoneSearch(e.target.value)}
                    className="text-[11px] pl-6 pr-2 py-0.5 border border-slate-200 rounded text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                  />
                  <Search className="w-3 h-3 text-slate-400 absolute left-1.5 top-1.5" />
                </div>
              </div>
              <Select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                helperText="Local calendar dates are calculated in this timezone"
              >
                {!filteredTimezones.includes(formData.timezone) && (
                  <option value={formData.timezone}>{formData.timezone} (Current)</option>
                )}
                {filteredTimezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Office Shift Start (24h)"
              type="time"
              required
              value={formData.officeStartTime}
              onChange={(e) => setFormData({ ...formData, officeStartTime: e.target.value })}
            />

            <Input
              label="Office Shift End (24h)"
              type="time"
              required
              value={formData.officeEndTime}
              onChange={(e) => setFormData({ ...formData, officeEndTime: e.target.value })}
            />

            <Input
              label="Late Arrival Threshold (Minutes)"
              type="number"
              min="0"
              max="180"
              required
              value={formData.lateThresholdMinutes}
              onChange={(e) =>
                setFormData({ ...formData, lateThresholdMinutes: parseInt(e.target.value, 10) || 0 })
              }
              helperText="Logins after (Office Start + Threshold) are flagged as LATE"
            />

            <Input
              label="Unpaid Break Duration (Minutes)"
              type="number"
              min="0"
              max="480"
              value={formData.breakDurationMinutes}
              onChange={(e) =>
                setFormData({ ...formData, breakDurationMinutes: parseInt(e.target.value, 10) || 0 })
              }
              helperText="Deducted from daily working duration calculation"
            />

            <Input
              label="Half-Day Threshold (Hours)"
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={formData.halfDayThresholdHours}
              onChange={(e) =>
                setFormData({ ...formData, halfDayThresholdHours: parseFloat(e.target.value) || 0 })
              }
              helperText="Minimum hours to qualify as a half-day shift"
            />

            <Input
              label="Overtime Threshold (Hours)"
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={formData.overtimeThresholdHours}
              onChange={(e) =>
                setFormData({ ...formData, overtimeThresholdHours: parseFloat(e.target.value) || 0 })
              }
              helperText="Hours worked beyond this count as overtime"
            />

            <Input
              label="Auto Checkout Window (Hours after end)"
              type="number"
              min="0"
              max="24"
              value={formData.autoCheckoutHoursAfterEnd}
              onChange={(e) =>
                setFormData({ ...formData, autoCheckoutHoursAfterEnd: parseInt(e.target.value, 10) || 0 })
              }
              helperText="Grace period before shift is flagged unclosed"
            />

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Operational Working Days
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const isSelected = formData.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleWorkingDaysToggle(day)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                        isSelected
                          ? 'bg-brand-900 text-white border-brand-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="lg" isLoading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
