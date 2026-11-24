import React, { useEffect, useState } from 'react';
import { companyService } from '../../services/companyService';
import { User, Department } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  PlusCircle,
  Search,
  Edit,
  Eye,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Briefcase,
  Calendar,
} from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    employeeId: '',
    phone: '',
    departmentId: '',
    designation: '',
    joiningDate: '',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'COMPANY_ADMIN',
    status: 'active' as 'active' | 'inactive',
  });

  const { success, error } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        companyService.getEmployees({
          search,
          departmentId: departmentFilter,
          status: statusFilter,
          page,
          limit: 10,
        }),
        companyService.getDepartments(),
      ]);

      setEmployees(empRes.employees);
      setTotalPages(empRes.pagination.totalPages);
      setTotalCount(empRes.pagination.total);
      setDepartments(deptRes);
    } catch (err: any) {
      error(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, departmentFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const openAddModal = () => {
    setFormData({
      fullName: '',
      email: '',
      password: '',
      employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      phone: '',
      departmentId: departments[0]?._id || '',
      designation: '',
      joiningDate: new Date().toISOString().substring(0, 10),
      role: 'EMPLOYEE',
      status: 'active',
    });
    setAddModalOpen(true);
  };

  const openEditModal = (emp: User) => {
    setSelectedEmployee(emp);
    const deptId =
      typeof emp.departmentId === 'object' && emp.departmentId !== null
        ? emp.departmentId._id
        : (emp.departmentId as string) || '';

    setFormData({
      fullName: emp.fullName,
      email: emp.email,
      password: '', // optional on edit
      employeeId: emp.employeeId || '',
      phone: emp.phone || '',
      departmentId: deptId,
      designation: emp.designation || '',
      joiningDate: emp.joiningDate ? emp.joiningDate.substring(0, 10) : '',
      role: emp.role as any,
      status: emp.status,
    });
    setEditModalOpen(true);
  };

  const openViewModal = (emp: User) => {
    setSelectedEmployee(emp);
    setViewModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.employeeId || !formData.password) {
      error('Please fill in all required fields.');
      return;
    }

    setFormLoading(true);
    try {
      await companyService.createEmployee(formData);
      success(`Employee "${formData.fullName}" created successfully.`);
      setAddModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to create employee');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setFormLoading(true);
    try {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password; // do not overwrite password if empty

      await companyService.updateEmployee(selectedEmployee._id || selectedEmployee.id, payload);
      success(`Employee updated successfully.`);
      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to update employee');
    } finally {
      setFormLoading(false);
    }
  };

  const openToggleConfirm = (emp: User) => {
    setSelectedEmployee(emp);
    setConfirmModalOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!selectedEmployee) return;
    const newStatus = selectedEmployee.status === 'active' ? 'inactive' : 'active';
    setFormLoading(true);
    try {
      await companyService.toggleEmployeeStatus(
        selectedEmployee._id || selectedEmployee.id,
        newStatus
      );
      success(
        `Employee status changed to ${newStatus === 'active' ? 'Active' : 'Deactivated'}.`
      );
      setConfirmModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to update employee status');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Directory"
        subtitle={`Manage staff accounts, credentials, and organizational assignments (${totalCount} total)`}
        actions={
          <Button icon={<PlusCircle className="w-4 h-4" />} onClick={openAddModal}>
            Add Employee
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search by name, employee ID, designation, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
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

          <div className="w-full sm:w-36">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </Select>
          </div>

          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Search
          </Button>
        </form>
      </Card>

      {/* Employee Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading employee records..." />
        ) : employees.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No employees found"
              description="No employee records matched your criteria. Add your company's first employee to start recording attendance."
              icon={<Users className="w-8 h-8 text-slate-400" />}
              actionText="Add Employee"
              onAction={openAddModal}
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6 font-semibold">Employee</th>
                    <th className="py-3.5 px-6 font-semibold">Emp ID</th>
                    <th className="py-3.5 px-6 font-semibold">Department</th>
                    <th className="py-3.5 px-6 font-semibold">Designation</th>
                    <th className="py-3.5 px-6 font-semibold">Role</th>
                    <th className="py-3.5 px-6 font-semibold">Status</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const empId = emp._id || emp.id;
                    const deptName =
                      typeof emp.departmentId === 'object' && emp.departmentId !== null
                        ? emp.departmentId.name
                        : '--';
                    const isInactive = emp.status === 'inactive';

                    return (
                      <tr key={empId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-slate-900">{emp.fullName}</div>
                          <div className="text-xs text-slate-400">{emp.email}</div>
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs font-bold text-brand-800">
                          {emp.employeeId || '--'}
                        </td>
                        <td className="py-3.5 px-6 text-xs font-medium text-slate-700">
                          {deptName}
                        </td>
                        <td className="py-3.5 px-6 text-xs text-slate-600">
                          {emp.designation || '--'}
                        </td>
                        <td className="py-3.5 px-6 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              emp.role === 'COMPANY_ADMIN'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {emp.role === 'COMPANY_ADMIN' ? 'Admin' : 'Employee'}
                          </span>
                        </td>
                        <td className="py-3.5 px-6">
                          <StatusBadge status={emp.status} />
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openViewModal(emp)}
                              title="View Profile"
                              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(emp)}
                              title="Edit Details"
                              className="text-slate-400 hover:text-brand-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openToggleConfirm(emp)}
                              title={isInactive ? 'Reactivate Account' : 'Deactivate Account'}
                              className={`p-1.5 rounded-lg hover:bg-slate-100 transition ${
                                isInactive
                                  ? 'text-emerald-600 hover:text-emerald-700'
                                  : 'text-rose-500 hover:text-rose-700'
                              }`}
                            >
                              {isInactive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </button>
                          </div>
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

      {/* Add Employee Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add New Employee" maxWidth="lg">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              placeholder="e.g. Michael Scott"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />

            <Input
              label="Employee ID (Unique in Company)"
              required
              placeholder="e.g. EMP-104"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            />

            <Input
              label="Work Email"
              type="email"
              required
              placeholder="michael@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Input
              label="Initial Password"
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />

            <Select
              label="Department"
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
            >
              <option value="">-- No Department --</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>

            <Input
              label="Designation / Title"
              placeholder="e.g. Sales Manager"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            />

            <Input
              label="Contact Phone"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Joining Date"
              type="date"
              value={formData.joiningDate}
              onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
            />

            <Select
              label="Account Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            >
              <option value="EMPLOYEE">Employee (Self-Service)</option>
              <option value="COMPANY_ADMIN">Company Administrator</option>
            </Select>

            <Select
              label="Account Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={formLoading}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Employee" maxWidth="lg">
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />

            <Input
              label="Employee ID"
              required
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            />

            <Input
              label="Work Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Input
              label="New Password (Leave blank to keep current)"
              type="password"
              placeholder="Leave blank to preserve"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />

            <Select
              label="Department"
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
            >
              <option value="">-- No Department --</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>

            <Input
              label="Designation / Title"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            />

            <Input
              label="Contact Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Joining Date"
              type="date"
              value={formData.joiningDate}
              onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
            />

            <Select
              label="Account Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            >
              <option value="EMPLOYEE">Employee (Self-Service)</option>
              <option value="COMPANY_ADMIN">Company Administrator</option>
            </Select>

            <Select
              label="Account Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={formLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Profile Modal */}
      {selectedEmployee && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Employee Profile"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-12 h-12 rounded-full bg-brand-900 text-white flex items-center justify-center font-bold text-base">
                {selectedEmployee.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{selectedEmployee.fullName}</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedEmployee.employeeId || 'N/A'}</p>
              </div>
            </div>

            <div className="text-xs space-y-2.5">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </span>
                <span className="font-medium text-slate-800">{selectedEmployee.email}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </span>
                <span className="font-medium text-slate-800">{selectedEmployee.phone || '--'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Designation
                </span>
                <span className="font-medium text-slate-800">{selectedEmployee.designation || '--'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Joining Date
                </span>
                <span className="font-medium text-slate-800">
                  {selectedEmployee.joiningDate
                    ? new Date(selectedEmployee.joiningDate).toLocaleDateString()
                    : '--'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Account Status</span>
                <StatusBadge status={selectedEmployee.status} />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog for Deactivate / Reactivate */}
      <ConfirmDialog
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmToggleStatus}
        title={selectedEmployee?.status === 'active' ? 'Deactivate Employee' : 'Reactivate Employee'}
        message={
          selectedEmployee?.status === 'active'
            ? `Are you sure you want to deactivate "${selectedEmployee?.fullName}"? The employee will no longer be able to log in.`
            : `Reactivate "${selectedEmployee?.fullName}"? The employee will regain full login access.`
        }
        confirmText={selectedEmployee?.status === 'active' ? 'Deactivate' : 'Reactivate'}
        variant={selectedEmployee?.status === 'active' ? 'danger' : 'primary'}
        isLoading={formLoading}
      />
    </div>
  );
};
