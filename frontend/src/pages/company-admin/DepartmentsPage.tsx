import React, { useEffect, useState } from 'react';
import { companyService } from '../../services/companyService';
import { Department } from '../../types';
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
import { FolderTree, PlusCircle, Edit, Users } from 'lucide-react';

export const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });

  const { success, error } = useToast();

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await companyService.getDepartments();
      setDepartments(data);
    } catch (err: any) {
      error(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const openCreateModal = () => {
    setEditingDept(null);
    setFormData({ name: '', description: '', status: 'active' });
    setModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      status: dept.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      error('Department name is required.');
      return;
    }

    setFormLoading(true);
    try {
      if (editingDept) {
        await companyService.updateDepartment(editingDept._id, formData);
        success(`Department "${formData.name}" updated successfully.`);
      } else {
        await companyService.createDepartment(formData);
        success(`Department "${formData.name}" created successfully.`);
      }
      setModalOpen(false);
      loadDepartments();
    } catch (err: any) {
      error(err.message || 'Failed to save department.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organizational business units, operational teams, and staffing distribution."
        actions={
          <Button icon={<PlusCircle className="w-4 h-4" />} onClick={openCreateModal}>
            Add Department
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading departments..." />
        ) : departments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No departments found"
              description="Create departments like Engineering, Product, HR, or Sales to assign to your workforce."
              icon={<FolderTree className="w-8 h-8 text-slate-400" />}
              actionText="Create Department"
              onAction={openCreateModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Department Name</th>
                  <th className="py-3.5 px-6 font-semibold">Description</th>
                  <th className="py-3.5 px-6 font-semibold">Active Staff</th>
                  <th className="py-3.5 px-6 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((dept) => (
                  <tr key={dept._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">{dept.name}</td>
                    <td className="py-4 px-6 text-xs text-slate-500 max-w-xs truncate">
                      {dept.description || 'No description provided'}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dept.employeeCount ?? 0} members</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={dept.status} />
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Edit className="w-3.5 h-3.5" />}
                        onClick={() => openEditModal(dept)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Create Department'}
        maxWidth="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Department Name"
            required
            placeholder="e.g. Engineering, Sales, Operations"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="Description / Purpose"
            placeholder="Brief scope of responsibilities"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <Select
            label="Department Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={formLoading}>
              {editingDept ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
