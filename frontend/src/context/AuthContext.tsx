import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Company, Attendance } from '../types';
import { authService, LoginResponse } from '../services/authService';
import { getToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  todayAttendance: Attendance | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setTodayAttendance: (attendance: Attendance | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const existingToken = getToken();
    if (!existingToken) {
      setUser(null);
      setCompany(null);
      setTodayAttendance(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await authService.getMe();
      setUser(data.user);
      setCompany(data.company);
      if (data.todayAttendance) {
        setTodayAttendance(data.todayAttendance);
      }
    } catch (err) {
      console.error('[AuthContext] Session verification failed:', err);
      setUser(null);
      setCompany(null);
      setTodayAttendance(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      setCompany(response.company);
      setTokenState(response.token);
      if (response.todayAttendance) {
        setTodayAttendance(response.todayAttendance);
      }
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setCompany(null);
      setTodayAttendance(null);
      setTokenState(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        todayAttendance,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
        setTodayAttendance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
