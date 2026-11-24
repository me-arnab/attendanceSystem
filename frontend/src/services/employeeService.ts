import { api } from './api';
import { User, Attendance, Holiday } from '../types';

export interface EmployeeDashboardData {
  employee: User;
  company: {
    name: string;
    code: string;
    timezone: string;
    officeStartTime: string;
    officeEndTime: string;
    attendanceMode?: 'AUTO_ON_LOGIN' | 'MANUAL_PUNCH' | 'DISABLED';
    requireCheckOut?: boolean;
  };
  today: {
    date: string;
    attendance: Attendance | null;
    currentTime: string;
  };
  monthlyStats: {
    month: string;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    attendedDays: number;
    totalLoggedDays: number;
    attendancePercentage: number;
  };
  recentHistory: Attendance[];
  monthlyRecords: Attendance[];
}

export interface EmployeeHistoryResponse {
  records: Attendance[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const employeeService = {
  getDashboard: (): Promise<EmployeeDashboardData> => {
    return api.get('/employee/dashboard');
  },

  checkIn: (): Promise<Attendance> => {
    return api.post('/employee/attendance/checkin');
  },

  checkOut: (): Promise<Attendance> => {
    return api.post('/employee/attendance/checkout');
  },

  getAttendanceHistory: (params?: { month?: string; year?: string; page?: number; limit?: number }): Promise<EmployeeHistoryResponse> => {
    const query = new URLSearchParams();
    if (params?.month) query.append('month', params.month);
    if (params?.year) query.append('year', params.year);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return api.get(`/employee/attendance/history?${query.toString()}`);
  },

  getHolidays: (params?: { year?: number; month?: number; search?: string }): Promise<Holiday[]> => {
    const query = new URLSearchParams();
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month.toString());
    if (params?.search) query.append('search', params.search);
    return api.get(`/employee/holidays?${query.toString()}`);
  },

  getUpcomingHolidays: (): Promise<Holiday[]> => {
    return api.get('/employee/holidays/upcoming');
  },
};
