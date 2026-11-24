import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';
import { Company } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  PlusCircle,
  Search,
  Building2,
  CheckCircle,
  Ban,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Status toggle confirmation dialog
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [targetCompany, setTargetCompany] = useState<Company | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const navigate = useNavigate();
  const { success, error } = useToast();

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getCompanies({
        search,
        status: statusFilter,
        page,
        limit: 10,
      });
      setCompanies(res.companies);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      error(err.message || 'Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCompanies();
  };

  const handleToggleStatusClick = (company: Company) => {
    setTargetCompany(company);
    setConfirmModalOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!targetCompany) return;
    const newStatus = targetCompany.status === 'active' ? 'suspended' : 'active';
    setActionLoading(true);
    try {
      await superAdminService.toggleStatus(targetCompany._id || targetCompany.id, newStatus);
      success(
        `Company "${targetCompany.name}" has been ${newStatus === 'active' ? 'activated' : 'suspended'}.`
      );
      setConfirmModalOpen(false);
      loadCompanies();
    } catch (err: any) {
      error(err.message || 'Failed to update company status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Companies"
        subtitle={`Manage registered client organizations and tenant access (${totalCount} total)`}
        actions={
          <Button
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={() => navigate('/super-admin/companies/create')}
          >
            Create Company
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search companies by name, code, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Search
          </Button>
        </form>
      </Card>

      {/* Companies List */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading companies..." />
        ) : companies.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No companies found"
              description="No registered companies match your filter criteria. Try adjusting your search."
              icon={<Building2 className="w-8 h-8 text-slate-400" />}
              actionText="Register Company"
              onAction={() => navigate('/super-admin/companies/create')}
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6 font-semibold">Company Name</th>
                    <th className="py-3 px-6 font-semibold">Code</th>
                    <th className="py-3 px-6 font-semibold">Company Admin</th>
                    <th className="py-3 px-6 font-semibold">Timezone</th>
                    <th className="py-3 px-6 font-semibold">Employees</th>
                    <th className="py-3 px-6 font-semibold">Status</th>
                    <th className="py-3 px-6 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((comp) => {
                    const compId = comp._id || comp.id;
                    const isSuspended = comp.status === 'suspended';

                    return (
                      <tr key={compId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-900">{comp.name}</div>
                          <div className="text-xs text-slate-400">{comp.email}</div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs font-bold text-brand-800">
                          {comp.code}
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-medium text-slate-800">{comp.admin?.fullName || 'N/A'}</div>
                          <div className="text-xs text-slate-400">{comp.admin?.email || 'N/A'}</div>
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-600">
                          {comp.settings?.timezone || 'UTC'}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-700">
                          {comp.employeeCount ?? 0}
                        </td>
                        <td className="py-4 px-6">
                          <StatusBadge status={comp.status} />
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => navigate(`/super-admin/companies/${compId}`)}
                            >
                              Details
                            </Button>

                            <Button
                              variant={isSuspended ? 'outline' : 'danger'}
                              size="sm"
                              icon={
                                isSuspended ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Ban className="w-3.5 h-3.5" />
                                )
                              }
                              onClick={() => handleToggleStatusClick(comp)}
                            >
                              {isSuspended ? 'Activate' : 'Suspend'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
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

      {/* Confirmation Dialog for Suspend / Activate */}
      <ConfirmDialog
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmToggleStatus}
        title={targetCompany?.status === 'active' ? 'Suspend Company Access' : 'Activate Company Access'}
        message={
          targetCompany?.status === 'active'
            ? `Are you sure you want to suspend "${targetCompany?.name}"? All employees and company admins will immediately be blocked from logging in.`
            : `Are you sure you want to reactivate "${targetCompany?.name}"? Users will regain full access to their attendance portal.`
        }
        confirmText={targetCompany?.status === 'active' ? 'Suspend Company' : 'Reactivate Company'}
        variant={targetCompany?.status === 'active' ? 'danger' : 'primary'}
        isLoading={actionLoading}
      />
    </div>
  );
};
