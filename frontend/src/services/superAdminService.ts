import { api } from './api';
import { Company } from '../types';

export interface SuperAdminDashboardData {
  stats: {
    totalCompanies: number;
    activeCompanies: number;
    suspendedCompanies: number;
    totalEmployees: number;
    todayAttendance: number;
  };
  monthlyGrowth: { name: string; companies: number }[];
  recentCompanies: Company[];
}

export interface GetCompaniesResponse {
  companies: Company[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const superAdminService = {
  getDashboardStats: (): Promise<SuperAdminDashboardData> => {
    return api.get('/super-admin/dashboard');
  },

  getCompanies: (params?: { search?: string; status?: string; page?: number; limit?: number }): Promise<GetCompaniesResponse> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/super-admin/companies?${query.toString()}`);
  },

  getCompanyDetails: (id: string): Promise<{ company: Company; admin: any; employeeCount: number }> => {
    return api.get(`/super-admin/companies/${id}`);
  },

  createCompany: (data: any): Promise<{ company: Company; admin: any }> => {
    return api.post('/super-admin/companies', data);
  },

  updateCompany: (id: string, data: any): Promise<Company> => {
    return api.put(`/super-admin/companies/${id}`, data);
  },

  toggleStatus: (id: string, status: 'active' | 'suspended'): Promise<Company> => {
    return api.patch(`/super-admin/companies/${id}/status`, { status });
  },

  getPlatformSettings: (): Promise<any> => {
    return api.get('/super-admin/settings');
  },

  updatePlatformSettings: (data: any): Promise<any> => {
    return api.put('/super-admin/settings', data);
  },
};
