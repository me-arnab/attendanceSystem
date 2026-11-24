import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';
import { Company, User } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  Building2,
  User as UserIcon,
  Clock,
  ArrowLeft,
  Calendar,
  Users,
  CheckCircle,
  Ban,
  Mail,
  Phone,
  MapPin,
  Globe,
} from 'lucide-react';

export const CompanyDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [admin, setAdmin] = useState<User | null>(null);
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Status toggle confirmation
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await superAdminService.getCompanyDetails(id);
      setCompany(res.company);
      setAdmin(res.admin);
      setEmployeeCount(res.employeeCount);
    } catch (err: any) {
      error(err.message || 'Failed to fetch company details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const confirmToggleStatus = async () => {
    if (!company) return;
    const newStatus = company.status === 'active' ? 'suspended' : 'active';
    setActionLoading(true);
    try {
      await superAdminService.toggleStatus(company._id || company.id, newStatus);
      success(
        `Company status changed to ${newStatus === 'active' ? 'Active' : 'Suspended'}.`
      );
      setConfirmModalOpen(false);
      fetchDetails();
    } catch (err: any) {
      error(err.message || 'Failed to update company status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !company) {
    return <LoadingSpinner message="Loading company details..." />;
  }

  const isSuspended = company.status === 'suspended';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title={company.name}
        subtitle={`Tenant Organization Code: ${company.code}`}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/super-admin/companies')}
            >
              Back to List
            </Button>
            <Button
              variant={isSuspended ? 'outline' : 'danger'}
              icon={isSuspended ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Ban className="w-4 h-4" />}
              onClick={() => setConfirmModalOpen(true)}
            >
              {isSuspended ? 'Activate Tenant' : 'Suspend Tenant'}
            </Button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200/80 flex items-center justify-center text-brand-700">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Workforce</span>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{employeeCount}</h3>
            <p className="text-xs text-slate-500">Registered employees</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tenant Status</span>
            <div className="mt-1">
              <StatusBadge status={company.status} />
            </div>
            <p className="text-xs text-slate-500 mt-1">Platform access state</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Onboarded Date</span>
            <h3 className="text-sm font-bold text-slate-900 mt-1">
              {new Date(company.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </h3>
            <p className="text-xs text-slate-500">Registration timestamp</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader title="Company Information" subtitle="Legal entity registration details" />
          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Company Code</span>
              <span className="font-mono font-bold text-brand-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                {company.code}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-slate-400" /> Official Email
              </span>
              <span className="text-slate-900 font-medium">{company.email}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-slate-400" /> Phone
              </span>
              <span className="text-slate-900 font-medium">{company.phone || 'Not configured'}</span>
            </div>

            <div className="flex items-start justify-between py-2">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" /> Address
              </span>
              <span className="text-slate-900 font-medium text-right max-w-xs">
                {company.address || 'Not configured'}
              </span>
            </div>
          </div>
        </Card>

        {/* Company Admin Account */}
        <Card>
          <CardHeader title="Primary Company Admin" subtitle="Super Administrator designated account" />
          {admin ? (
            <div className="space-y-3.5 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 mb-2">
                <div className="w-10 h-10 rounded-full bg-brand-900 text-white flex items-center justify-center font-bold text-sm">
                  {admin.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{admin.fullName}</h4>
                  <p className="text-xs text-slate-500">{admin.designation || 'Company Administrator'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Login Email</span>
                <span className="text-slate-900 font-medium">{admin.email}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Contact Phone</span>
                <span className="text-slate-900 font-medium">{admin.phone || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">Account Status</span>
                <StatusBadge status={admin.status} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No primary administrator found for this company.</p>
          )}
        </Card>

        {/* Attendance Settings */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Configured Attendance & Shift Rules"
            subtitle="Automated check-in policies applied to all employees of this company"
          />

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Timezone
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-2">
                {company.settings?.timezone || 'UTC'}
              </h4>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Shift Schedule
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-2">
                {company.settings?.officeStartTime} - {company.settings?.officeEndTime}
              </h4>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Late Threshold
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-2">
                {company.settings?.lateThresholdMinutes} Minutes
              </h4>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Working Days</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {(company.settings?.workingDays || []).map((d) => (
                  <span
                    key={d}
                    className="text-[10px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium"
                  >
                    {d.slice(0, 3)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmToggleStatus}
        title={isSuspended ? 'Reactivate Company Access' : 'Suspend Company Access'}
        message={
          isSuspended
            ? `Reactivate "${company.name}"? Users will regain full access to sign in and record attendance.`
            : `Suspend "${company.name}"? All accounts associated with this tenant will immediately be blocked from logging in.`
        }
        confirmText={isSuspended ? 'Reactivate Tenant' : 'Suspend Tenant'}
        variant={isSuspended ? 'primary' : 'danger'}
        isLoading={actionLoading}
      />
    </div>
  );
};
