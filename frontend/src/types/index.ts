export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE';
export type UserStatus = 'active' | 'inactive';
export type CompanyStatus = 'active' | 'suspended';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'INCOMPLETE';
export type AttendanceMode = 'AUTO_ON_LOGIN' | 'MANUAL_PUNCH' | 'DISABLED';

export interface User {
  id: string;
  _id?: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyId?: string | null;
  employeeId?: string;
  phone?: string;
  departmentId?: string | { _id: string; name: string } | null;
  designation?: string;
  joiningDate?: string;
  createdAt?: string;
}

export interface CompanySettings {
  timezone: string;
  officeStartTime: string;
  officeEndTime: string;
  workingDays: string[];
  lateThresholdMinutes: number;
  attendanceMode?: AttendanceMode;
  requireCheckOut?: boolean;
  breakDurationMinutes?: number;
  halfDayThresholdHours?: number;
  overtimeThresholdHours?: number;
  autoCheckoutHoursAfterEnd?: number;
  logoUrl?: string;
}

export interface Company {
  id: string;
  _id?: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  status: CompanyStatus;
  settings: CompanySettings;
  createdAt: string;
  admin?: {
    _id?: string;
    id?: string;
    fullName: string;
    email: string;
    phone?: string;
    status?: string;
  };
  employeeCount?: number;
}

export interface Department {
  _id: string;
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  employeeCount?: number;
  createdAt: string;
}

export interface Attendance {
  _id: string;
  id?: string;
  companyId: string;
  employeeId: User | string;
  date: string; // YYYY-MM-DD
  checkIn?: string | null;
  checkOut?: string | null;
  status: AttendanceStatus;
  workingMinutes: number;
  isManualCorrection: boolean;
  correctionReason?: string;
  correctedBy?: { _id: string; fullName: string; role: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  _id: string;
  companyId?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export type HolidayType = 'NATIONAL' | 'REGIONAL' | 'COMPANY' | 'OPTIONAL';

export interface Holiday {
  _id: string;
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  date: string;
  endDate?: string | null;
  holidayType: HolidayType;
  isRecurring: boolean;
  originalDate?: string;
  originalEndDate?: string | null;
  createdBy?: { _id: string; fullName: string; email: string } | string;
  createdAt?: string;
  updatedAt?: string;
}
