import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { Building2, User, Clock, ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { getSupportedTimezones } from '../../utils/timezone';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const CreateCompanyPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    code: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
    timezone: 'UTC',
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    lateThresholdMinutes: 15,
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });

  const allTimezones = useMemo(() => getSupportedTimezones(formData.timezone), [formData.timezone]);

  const filteredTimezones = useMemo(() => {
    if (!timezoneSearch.trim()) return allTimezones;
    const q = timezoneSearch.toLowerCase();
    const matches = allTimezones.filter((tz) => tz.toLowerCase().includes(q));
    if (formData.timezone && !matches.includes(formData.timezone)) {
      return [formData.timezone, ...matches];
    }
    return matches;
  }, [allTimezones, timezoneSearch, formData.timezone]);

  const generateCompanyCode = () => {
    if (!formData.name) {
      toastError('Please enter a company name first.');
      return;
    }
    const clean = formData.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
    const rand = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({ ...prev, code: `${clean}-${rand}` }));
  };

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
    if (!formData.name || !formData.email || !formData.adminFullName || !formData.adminEmail || !formData.adminPassword) {
      toastError('Please fill in all mandatory fields.');
      return;
    }

    if (formData.workingDays.length === 0) {
      toastError('Please select at least one working day.');
      return;
    }

    setLoading(true);
    try {
      const res = await superAdminService.createCompany({
        ...formData,
        code: formData.code.trim().toUpperCase() || undefined,
        lateThresholdMinutes: Number(formData.lateThresholdMinutes),
      });

      success(`Company "${res.company.name}" and Admin account successfully created!`);
      navigate(`/super-admin/companies/${res.company._id || res.company.id}`);
    } catch (err: any) {
      toastError(err.message || 'Failed to create company.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Register New Company"
        subtitle="Onboard a new enterprise tenant and create its primary Company Administrator."
        actions={
          <Button
            variant="outline"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/super-admin/companies')}
          >
            Back to Companies
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Company Profile */}
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-brand-700" />
            <h3 className="text-base font-semibold text-slate-900">Organization Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Company Legal Name"
              required
              placeholder="e.g. Acme Corporation"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Company Code <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateCompanyCode}
                  className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Auto-generate
                </button>
              </div>
              <Input
                placeholder="e.g. ACME-1024"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                helperText="Unique uppercase identifier for this tenant"
              />
            </div>

            <Input
              label="Official Contact Email"
              type="email"
              required
              placeholder="contact@acme.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Input
              label="Contact Phone"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <div className="sm:col-span-2">
              <Input
                label="Physical Address / HQ"
                placeholder="123 Corporate Blvd, Suite 400"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Initial Company Administrator Account */}
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <User className="w-5 h-5 text-brand-700" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Company Administrator Account</h3>
              <p className="text-xs text-slate-500">
                Primary admin user will manage departments, employees, and attendance for this company.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Admin Full Name"
              required
              placeholder="e.g. Jane Doe"
              value={formData.adminFullName}
              onChange={(e) => setFormData({ ...formData, adminFullName: e.target.value })}
            />

            <Input
              label="Admin Work Email"
              type="email"
              required
              placeholder="admin@acme.com"
              value={formData.adminEmail}
              onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
            />

            <div className="sm:col-span-2">
              <Input
                label="Initial Password"
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={formData.adminPassword}
                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                helperText="Secure temporary or permanent password for the administrator"
              />
            </div>
          </div>
        </Card>

        {/* Section 3: Attendance Configuration */}
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Clock className="w-5 h-5 text-brand-700" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Attendance Policies & Shifts</h3>
              <p className="text-xs text-slate-500">
                Configures timezone calculations and automatic late-arrival evaluation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Operating Timezone</label>
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
                helperText="Determines daily calendar dates"
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
              label="Office Start Time (24h)"
              type="time"
              required
              value={formData.officeStartTime}
              onChange={(e) => setFormData({ ...formData, officeStartTime: e.target.value })}
            />

            <Input
              label="Office End Time (24h)"
              type="time"
              required
              value={formData.officeEndTime}
              onChange={(e) => setFormData({ ...formData, officeEndTime: e.target.value })}
            />

            <div className="sm:col-span-3">
              <Input
                label="Late Threshold (Minutes)"
                type="number"
                min="0"
                max="180"
                required
                value={formData.lateThresholdMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, lateThresholdMinutes: parseInt(e.target.value, 10) || 0 })
                }
                helperText="Logins after Start Time + Threshold Minutes are marked LATE"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Standard Working Days
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const selected = formData.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleWorkingDaysToggle(day)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                        selected
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

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/super-admin/companies')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" isLoading={loading}>
            Create Company & Administrator
          </Button>
        </div>
      </form>
    </div>
  );
};
