import React, { useEffect, useState } from 'react';
import { companyService } from '../../services/companyService';
import { Attendance, Department, AttendanceStatus } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { toDateTimeLocalString, formatTimeInTimezone } from '../../utils/dateUtils';
import {
  CalendarCheck,
  Search,
  Filter,
  Edit3,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { company } = useAuth();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Manual Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    status: 'PRESENT' as AttendanceStatus,
    checkIn: '',
    checkOut: '',
    reason: '',
  });

  const { success, error } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [attRes, deptRes] = await Promise.all([
        companyService.getAttendanceList({
          date: dateFilter || undefined,
          departmentId: departmentFilter,
          status: statusFilter,
          page,
          limit: 15,
        }),
        companyService.getDepartments(),
      ]);

      setRecords(attRes.records);
      setTotalPages(attRes.pagination.totalPages);
      setTotalCount(attRes.pagination.total);
      setDepartments(deptRes);
    } catch (err: any) {
      error(err.message || 'Failed to fetch attendance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, dateFilter, departmentFilter, statusFilter]);

  const openCorrectionModal = (record: Attendance) => {
    setSelectedRecord(record);
    const tz = company?.settings?.timezone;
    const checkInIso = record.checkIn ? toDateTimeLocalString(record.checkIn, tz) : '';
    const checkOutIso = record.checkOut ? toDateTimeLocalString(record.checkOut, tz) : '';

    setCorrectionForm({
      status: record.status,
      checkIn: checkInIso,
      checkOut: checkOutIso,
      reason: '',
    });
    setCorrectionModalOpen(true);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (!correctionForm.reason.trim() || correctionForm.reason.trim().length < 5) {
      error('A justification reason of at least 5 characters is required for audit compliance.');
      return;
    }

    setCorrectionLoading(true);
    try {
      await companyService.correctAttendance(selectedRecord._id || selectedRecord.id!, {
        status: correctionForm.status,
        checkIn: correctionForm.checkIn ? new Date(correctionForm.checkIn).toISOString() : null,
        checkOut: correctionForm.checkOut ? new Date(correctionForm.checkOut).toISOString() : null,
        reason: correctionForm.reason,
      });

      success('Attendance record corrected and audit log recorded.');
      setCorrectionModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to correct attendance');
    } finally {
      setCorrectionLoading(false);
    }
  };

  const resetFilters = () => {
    setDateFilter('');
    setDepartmentFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Records"
        subtitle={`Track live clock-in timestamps, working durations, and perform audit-logged corrections (${totalCount} entries)`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const todayIso = new Date().toISOString().substring(0, 10);
                setDateFilter(todayIso);
                setPage(1);
              }}
            >
              Filter Today
            </Button>
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear Filter
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Input
              type="date"
              label="Calendar Date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Select
              label="Department"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Select
              label="Attendance Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="INCOMPLETE">Incomplete</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Attendance Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading attendance records..." />
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No attendance records found"
              description="No attendance logs found matching the selected dates and criteria."
              icon={<CalendarCheck className="w-8 h-8 text-slate-400" />}
              actionText="Reset Filters"
              onAction={resetFilters}
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6 font-semibold">Employee</th>
                    <th className="py-3.5 px-6 font-semibold">Department</th>
                    <th className="py-3.5 px-6 font-semibold">Date</th>
                    <th className="py-3.5 px-6 font-semibold">Check-In</th>
                    <th className="py-3.5 px-6 font-semibold">Check-Out</th>
                    <th className="py-3.5 px-6 font-semibold">Working Hours</th>
                    <th className="py-3.5 px-6 font-semibold">Status</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Correction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((rec) => {
                    const emp: any = rec.employeeId;
                    const deptName = emp?.departmentId?.name || '--';

                    const checkInFormatted = rec.checkIn
                      ? formatTimeInTimezone(rec.checkIn, company?.settings?.timezone)
                      : '--:--';
                    const checkOutFormatted = rec.checkOut
                      ? formatTimeInTimezone(rec.checkOut, company?.settings?.timezone)
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
                        <td className="py-3.5 px-6 text-xs text-slate-600 font-medium">
                          {deptName}
                        </td>
                        <td className="py-3.5 px-6 text-xs text-slate-800 font-medium">
                          {rec.date}
                        </td>
                        <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-800">
                          {checkInFormatted}
                        </td>
                        <td className="py-3.5 px-6 text-xs font-mono font-medium text-slate-800">
                          {checkOutFormatted}
                        </td>
                        <td className="py-3.5 px-6 text-xs font-semibold text-slate-700">
                          {rec.workingMinutes > 0 ? `${durationHours} hrs` : '--'}
                        </td>
                        <td className="py-3.5 px-6">
                          <StatusBadge status={rec.status} />
                          {rec.isManualCorrection && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                              <span>Manual</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Edit3 className="w-3 h-3" />}
                            onClick={() => openCorrectionModal(rec)}
                          >
                            Correct
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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

      {/* Manual Attendance Correction Modal */}
      {selectedRecord && (
        <Modal
          isOpen={correctionModalOpen}
          onClose={() => setCorrectionModalOpen(false)}
          title="Manual Attendance Correction"
          subtitle="All manual overrides require an explicit reason and are logged to the audit trail."
          maxWidth="md"
        >
          <form onSubmit={handleCorrectionSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div>
                <span className="text-slate-500">Target Employee: </span>
                <span className="font-bold text-slate-900">
                  {(selectedRecord.employeeId as any)?.fullName}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Attendance Date: </span>
                <span className="font-mono font-semibold text-brand-900">{selectedRecord.date}</span>
              </div>
            </div>

            <Select
              label="New Attendance Status"
              required
              value={correctionForm.status}
              onChange={(e) =>
                setCorrectionForm({ ...correctionForm, status: e.target.value as AttendanceStatus })
              }
            >
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="INCOMPLETE">Incomplete</option>
            </Select>

            <Input
              label="Check-In Timestamp"
              type="datetime-local"
              value={correctionForm.checkIn}
              onChange={(e) => setCorrectionForm({ ...correctionForm, checkIn: e.target.value })}
            />

            <Input
              label="Check-Out Timestamp"
              type="datetime-local"
              value={correctionForm.checkOut}
              onChange={(e) => setCorrectionForm({ ...correctionForm, checkOut: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Correction Justification Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="State the reason for this manual adjustment (e.g. system outage, forgot badge, approved remote duty)..."
                value={correctionForm.reason}
                onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">Minimum 5 characters required for audit trail.</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setCorrectionModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={correctionLoading}>
                Apply Correction & Log Audit
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
