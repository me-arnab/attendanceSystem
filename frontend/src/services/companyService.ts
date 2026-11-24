import { api } from './api';
import { User, Department, Attendance, Company, AuditLog, Holiday } from '../types';

export interface CompanyDashboardMetrics {
  stats: {
    totalEmployees: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    attendanceRate: number;
    todayDate: string;
  };
  trend: { date: string; present: number; late: number; absent: number }[];
  departmentSummary: { id: string; name: string; employeeCount: number }[];
  recentActivity: Attendance[];
}

export interface GetEmployeesResponse {
  employees: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface GetAttendanceResponse {
  records: Attendance[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ReportsResponse {
  summary: {
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    incompleteCount: number;
    avgWorkingHours: string;
  };
  records: Attendance[];
}

export const companyService = {
  getDashboardMetrics: (): Promise<CompanyDashboardMetrics> => {
    return api.get('/company/dashboard');
  },

  // Employees
  getEmployees: (params?: { search?: string; departmentId?: string; status?: string; role?: string; page?: number; limit?: number }): Promise<GetEmployeesResponse> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.status) query.append('status', params.status);
    if (params?.role) query.append('role', params.role);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/company/employees?${query.toString()}`);
  },

  getEmployeeById: (id: string): Promise<User> => {
    return api.get(`/company/employees/${id}`);
  },

  createEmployee: (data: any): Promise<User> => {
    return api.post('/company/employees', data);
  },

  updateEmployee: (id: string, data: any): Promise<User> => {
    return api.put(`/company/employees/${id}`, data);
  },

  toggleEmployeeStatus: (id: string, status: 'active' | 'inactive'): Promise<{ id: string; status: string }> => {
    return api.patch(`/company/employees/${id}/status`, { status });
  },

  // Departments
  getDepartments: (): Promise<Department[]> => {
    return api.get('/company/departments');
  },

  createDepartment: (data: { name: string; description?: string; status?: string }): Promise<Department> => {
    return api.post('/company/departments', data);
  },

  updateDepartment: (id: string, data: Partial<Department>): Promise<Department> => {
    return api.put(`/company/departments/${id}`, data);
  },

  // Attendance
  getAttendanceList: (params?: { date?: string; startDate?: string; endDate?: string; departmentId?: string; status?: string; employeeId?: string; page?: number; limit?: number }): Promise<GetAttendanceResponse> => {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    if (params?.status) query.append('status', params.status);
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/company/attendance?${query.toString()}`);
  },

  correctAttendance: (id: string, data: { status: string; reason: string; checkIn?: string | null; checkOut?: string | null }): Promise<Attendance> => {
    return api.patch(`/company/attendance/${id}/correction`, data);
  },

  // Reports
  getReports: (params: { type: 'daily' | 'monthly'; date?: string; month?: string; year?: string; departmentId?: string; employeeId?: string }): Promise<ReportsResponse> => {
    const query = new URLSearchParams();
    query.append('type', params.type);
    if (params.date) query.append('date', params.date);
    if (params.month) query.append('month', params.month);
    if (params.year) query.append('year', params.year);
    if (params.departmentId) query.append('departmentId', params.departmentId);
    if (params.employeeId) query.append('employeeId', params.employeeId);
    return api.get(`/company/reports?${query.toString()}`);
  },

  // Settings
  getSettings: (): Promise<Company> => {
    return api.get('/company/settings');
  },

  updateSettings: (data: any): Promise<Company> => {
    return api.put('/company/settings', data);
  },

  // Audit Logs
  getAuditLogs: (): Promise<AuditLog[]> => {
    return api.get('/company/audit-logs');
  },

  // Holidays
  getHolidays: (params?: { year?: number; month?: number; search?: string }): Promise<Holiday[]> => {
    const query = new URLSearchParams();
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month.toString());
    if (params?.search) query.append('search', params.search);
    return api.get(`/company/holidays?${query.toString()}`);
  },

  createHoliday: (data: Partial<Holiday>): Promise<Holiday> => {
    return api.post('/company/holidays', data);
  },

  updateHoliday: (id: string, data: Partial<Holiday>): Promise<Holiday> => {
    return api.put(`/company/holidays/${id}`, data);
  },

  deleteHoliday: (id: string): Promise<{ id: string }> => {
    return api.delete(`/company/holidays/${id}`);
  },
};
