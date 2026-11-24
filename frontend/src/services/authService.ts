import { api, setToken, removeToken } from './api';
import { User, Company, Attendance } from '../types';

export interface LoginResponse {
  token: string;
  user: User;
  company: Company | null;
  todayAttendance?: Attendance | null;
}

export const authService = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>('/auth/login', credentials);
    if (res.token) {
      setToken(res.token);
    }
    return res;
  },

  getMe: async (): Promise<{ user: User; company: Company | null; todayAttendance?: Attendance | null }> => {
    return api.get('/auth/me');
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      removeToken();
    }
  },
};
