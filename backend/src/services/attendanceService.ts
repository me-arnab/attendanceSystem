import { Types } from 'mongoose';
import { Company, ICompany } from '../models/Company';
import { Attendance, IAttendance, AttendanceStatus } from '../models/Attendance';
import { IUser } from '../models/User';
import { isCompanyHoliday } from './holidayService';

export interface TimezoneDateInfo {
  dateString: string; // 'YYYY-MM-DD'
  currentTimeString: string; // 'HH:mm'
  dayOfWeek: string; // 'Monday', 'Tuesday', etc.
  localHour: number;
  localMinute: number;
}

/**
 * Returns date components formatted in the company's configured timezone
 */
export const getTimezoneDateInfo = (date: Date, timezone = 'UTC'): TimezoneDateInfo => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const year = partMap.year;
    const month = partMap.month;
    const day = partMap.day;
    const hour = parseInt(partMap.hour === '24' ? '00' : partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);
    const dayOfWeek = partMap.weekday;

    const dateString = `${year}-${month}-${day}`;
    const currentTimeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    return {
      dateString,
      currentTimeString,
      dayOfWeek,
      localHour: hour,
      localMinute: minute,
    };
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    const iso = date.toISOString();
    return {
      dateString: iso.substring(0, 10),
      currentTimeString: iso.substring(11, 16),
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
        date.getUTCDay()
      ],
      localHour: date.getUTCHours(),
      localMinute: date.getUTCMinutes(),
    };
  }
};

/**
 * Check whether a day is configured as an active working day for the company
 */
export const isWorkingDay = (
  dayOfWeek: string,
  workingDays: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
): boolean => {
  if (!workingDays || workingDays.length === 0) return true;
  const normalizedDay = dayOfWeek.trim().toLowerCase();
  return workingDays.some((d) => d.trim().toLowerCase() === normalizedDay);
};

/**
 * Determine if check-in is LATE or PRESENT based on office start time and threshold
 */
export const determineAttendanceStatus = (
  localHour: number,
  localMinute: number,
  officeStartTime = '09:00',
  lateThresholdMinutes = 15
): AttendanceStatus => {
  const [startHourStr, startMinuteStr] = officeStartTime.split(':');
  const startHour = parseInt(startHourStr || '9', 10);
  const startMinute = parseInt(startMinuteStr || '0', 10);

  const checkInTotalMinutes = localHour * 60 + localMinute;
  const startTotalMinutes = startHour * 60 + startMinute;
  const lateCutoffMinutes = startTotalMinutes + lateThresholdMinutes;

  if (checkInTotalMinutes > lateCutoffMinutes) {
    return 'LATE';
  }
  return 'PRESENT';
};

/**
 * Calculates working minutes between checkIn and checkOut, safely deducting break duration
 */
export const calculateWorkingMinutes = (
  checkIn: Date,
  checkOut: Date,
  breakDurationMinutes = 0
): number => {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  if (diffMs <= 0) return 0;
  const totalMinutes = Math.round(diffMs / (1000 * 60));
  return Math.max(0, totalMinutes - Math.max(0, breakDurationMinutes));
};

/**
 * Automatically creates or retrieves today's attendance record on employee login (AUTO_ON_LOGIN mode)
 */
export const processLoginAttendance = async (
  employee: IUser,
  company: ICompany
): Promise<{ attendance: IAttendance | null; isNewRecord: boolean }> => {
  const attendanceMode = company.settings?.attendanceMode || 'AUTO_ON_LOGIN';

  // 1. If attendance is DISABLED, do not create or process attendance
  if (attendanceMode === 'DISABLED') {
    return { attendance: null, isNewRecord: false };
  }

  const timezone = company.settings?.timezone || 'UTC';
  const now = new Date();
  const tzInfo = getTimezoneDateInfo(now, timezone);

  // 2. If MANUAL_PUNCH mode, login must NOT create attendance
  if (attendanceMode === 'MANUAL_PUNCH') {
    const existing = await Attendance.findOne({
      companyId: company._id,
      employeeId: employee._id,
      date: tzInfo.dateString,
    });
    return { attendance: existing, isNewRecord: false };
  }

  // 3. AUTO_ON_LOGIN mode:
  // Respect company working days: Non-working day logins MUST NOT create attendance
  const workingDays = company.settings?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (!isWorkingDay(tzInfo.dayOfWeek, workingDays)) {
    const existing = await Attendance.findOne({
      companyId: company._id,
      employeeId: employee._id,
      date: tzInfo.dateString,
    });
    return { attendance: existing, isNewRecord: false };
  }

  // Respect approved company holidays: Holiday logins MUST NOT create ordinary attendance
  const holidayCheck = await isCompanyHoliday(company._id, tzInfo.dateString);
  if (holidayCheck.isHoliday) {
    const existing = await Attendance.findOne({
      companyId: company._id,
      employeeId: employee._id,
      date: tzInfo.dateString,
    });
    return { attendance: existing, isNewRecord: false };
  }

  // Check if attendance already exists for today in company's local date
  const existingRecord = await Attendance.findOne({
    companyId: company._id,
    employeeId: employee._id,
    date: tzInfo.dateString,
  });

  if (existingRecord) {
    return { attendance: existingRecord, isNewRecord: false };
  }

  // Calculate PRESENT or LATE status
  const officeStartTime = company.settings?.officeStartTime || '09:00';
  const lateThreshold = company.settings?.lateThresholdMinutes ?? 15;
  const status = determineAttendanceStatus(
    tzInfo.localHour,
    tzInfo.localMinute,
    officeStartTime,
    lateThreshold
  );

  try {
    const newRecord = await Attendance.create({
      companyId: company._id,
      employeeId: employee._id,
      date: tzInfo.dateString,
      checkIn: now,
      status,
      workingMinutes: 0,
      isManualCorrection: false,
    });

    return { attendance: newRecord, isNewRecord: true };
  } catch (err: any) {
    // In case of race conditions with compound unique index
    if (err.code === 11000) {
      const raceRecord = await Attendance.findOne({
        companyId: company._id,
        employeeId: employee._id,
        date: tzInfo.dateString,
      });
      if (raceRecord) {
        return { attendance: raceRecord, isNewRecord: false };
      }
    }
    throw err;
  }
};

/**
 * Dedicated Employee Manual Check-In Action (MANUAL_PUNCH mode)
 */
export const processManualCheckIn = async (
  employee: IUser,
  company: ICompany
): Promise<IAttendance> => {
  const attendanceMode = company.settings?.attendanceMode || 'AUTO_ON_LOGIN';

  if (attendanceMode === 'DISABLED') {
    const error: any = new Error('Attendance tracking is disabled for your company.');
    error.statusCode = 400;
    throw error;
  }

  const timezone = company.settings?.timezone || 'UTC';
  const now = new Date();
  const tzInfo = getTimezoneDateInfo(now, timezone);

  // Check for existing check-in today
  const existing = await Attendance.findOne({
    companyId: company._id,
    employeeId: employee._id,
    date: tzInfo.dateString,
  });

  if (existing) {
    const error: any = new Error('You have already checked in today.');
    error.statusCode = 400;
    throw error;
  }

  const workingDays = company.settings?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const isWorkDay = isWorkingDay(tzInfo.dayOfWeek, workingDays);
  const holidayCheck = await isCompanyHoliday(company._id, tzInfo.dateString);
  const officeStartTime = company.settings?.officeStartTime || '09:00';
  const lateThreshold = company.settings?.lateThresholdMinutes ?? 15;

  // Working day & holiday enforcement: non-working day or holiday manual check-ins are recorded as PRESENT (never LATE)
  const status = isWorkDay && !holidayCheck.isHoliday
    ? determineAttendanceStatus(tzInfo.localHour, tzInfo.localMinute, officeStartTime, lateThreshold)
    : 'PRESENT';

  try {
    const record = await Attendance.create({
      companyId: company._id,
      employeeId: employee._id,
      date: tzInfo.dateString,
      checkIn: now,
      status,
      workingMinutes: 0,
      isManualCorrection: false,
    });

    return record;
  } catch (err: any) {
    if (err.code === 11000) {
      const error: any = new Error('You have already checked in today.');
      error.statusCode = 400;
      throw error;
    }
    throw err;
  }
};

/**
 * Dedicated Employee Manual Check-Out Action
 */
export const processManualCheckOut = async (
  employee: IUser,
  company: ICompany
): Promise<IAttendance> => {
  const attendanceMode = company.settings?.attendanceMode || 'AUTO_ON_LOGIN';

  if (attendanceMode === 'DISABLED') {
    const error: any = new Error('Attendance tracking is disabled for your company.');
    error.statusCode = 400;
    throw error;
  }

  const timezone = company.settings?.timezone || 'UTC';
  const now = new Date();
  const tzInfo = getTimezoneDateInfo(now, timezone);

  const attendance = await Attendance.findOne({
    companyId: company._id,
    employeeId: employee._id,
    date: tzInfo.dateString,
  });

  if (!attendance || !attendance.checkIn) {
    const error: any = new Error('No active check-in record found for today. Please check in first.');
    error.statusCode = 400;
    throw error;
  }

  if (attendance.checkOut) {
    const formatted = new Date(attendance.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const error: any = new Error(`You have already checked out today at ${formatted}.`);
    error.statusCode = 400;
    throw error;
  }

  if (now.getTime() < attendance.checkIn.getTime()) {
    const error: any = new Error('Check-out timestamp cannot be earlier than check-in time.');
    error.statusCode = 400;
    throw error;
  }

  const breakDuration = company.settings?.breakDurationMinutes || 0;
  attendance.checkOut = now;
  attendance.workingMinutes = calculateWorkingMinutes(attendance.checkIn, now, breakDuration);
  await attendance.save();

  return attendance;
};
