import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Attendance } from '../models/Attendance';
import { Company } from '../models/Company';
import { sendSuccess, sendError } from '../utils/response';
import {
  getTimezoneDateInfo,
  processManualCheckIn,
  processManualCheckOut,
} from '../services/attendanceService';

export const getEmployeeDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!._id;
    const companyId = req.user!.companyId as Types.ObjectId;

    const company = req.company || (await Company.findById(companyId));
    const timezone = company?.settings?.timezone || 'UTC';
    const now = new Date();
    const tzInfo = getTimezoneDateInfo(now, timezone);
    const todayStr = tzInfo.dateString;

    // Today's attendance
    const todayAttendance = await Attendance.findOne({
      companyId,
      employeeId,
      date: todayStr,
    });

    // Current month string prefix 'YYYY-MM'
    const currentMonthPrefix = todayStr.substring(0, 7);

    // All records for current month
    const monthlyRecords = await Attendance.find({
      companyId,
      employeeId,
      date: { $regex: `^${currentMonthPrefix}` },
    }).sort({ date: 1 });

    const monthlyPresent = monthlyRecords.filter((r) => r.status === 'PRESENT').length;
    const monthlyLate = monthlyRecords.filter((r) => r.status === 'LATE').length;
    const monthlyAbsent = monthlyRecords.filter((r) => r.status === 'ABSENT').length;
    const totalWorkingDays = monthlyRecords.length;

    const attendedDays = monthlyPresent + monthlyLate;
    const attendancePercentage =
      totalWorkingDays > 0 ? Math.round((attendedDays / totalWorkingDays) * 100) : 100;

    // Recent 10 attendances
    const recentHistory = await Attendance.find({
      companyId,
      employeeId,
    })
      .sort({ date: -1 })
      .limit(10);

    sendSuccess(res, {
      employee: {
        id: req.user!._id,
        fullName: req.user!.fullName,
        email: req.user!.email,
        employeeId: req.user!.employeeId,
        designation: req.user!.designation,
        joiningDate: req.user!.joiningDate,
      },
      company: {
        name: company?.name,
        code: company?.code,
        timezone,
        officeStartTime: company?.settings?.officeStartTime,
        officeEndTime: company?.settings?.officeEndTime,
        attendanceMode: company?.settings?.attendanceMode || 'AUTO_ON_LOGIN',
        requireCheckOut: company?.settings?.requireCheckOut ?? true,
      },
      today: {
        date: todayStr,
        attendance: todayAttendance,
        currentTime: tzInfo.currentTimeString,
      },
      monthlyStats: {
        month: currentMonthPrefix,
        presentDays: monthlyPresent,
        lateDays: monthlyLate,
        absentDays: monthlyAbsent,
        attendedDays,
        totalLoggedDays: totalWorkingDays,
        attendancePercentage,
      },
      recentHistory,
      monthlyRecords,
    });
  } catch (error: any) {
    console.error('[EmployeeController.getEmployeeDashboard] Error:', error);
    sendError(res, 'Failed to fetch employee dashboard data.', 500);
  }
};

/**
 * Dedicated Manual Check-in Action (MANUAL_PUNCH mode)
 */
export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId as Types.ObjectId;
    const company = req.company || (await Company.findById(companyId));
    if (!company) {
      sendError(res, 'Associated company record not found.', 404);
      return;
    }

    const attendance = await processManualCheckIn(req.user!, company);
    sendSuccess(res, attendance, 'Successfully checked in for today.', 201);
  } catch (error: any) {
    console.error('[EmployeeController.checkIn] Error:', error);
    sendError(res, error.message || 'Failed to process check-in.', error.statusCode || 500);
  }
};

/**
 * Dedicated Manual Check-out Action
 */
export const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId as Types.ObjectId;
    const company = req.company || (await Company.findById(companyId));
    if (!company) {
      sendError(res, 'Associated company record not found.', 404);
      return;
    }

    const attendance = await processManualCheckOut(req.user!, company);
    sendSuccess(res, attendance, 'Successfully checked out for today.');
  } catch (error: any) {
    console.error('[EmployeeController.checkOut] Error:', error);
    sendError(res, error.message || 'Failed to process check-out.', error.statusCode || 500);
  }
};

/**
 * Get full personal attendance history with date filtering
 */
export const getMyAttendanceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!._id;
    const companyId = req.user!.companyId as Types.ObjectId;
    const { month, year, startDate, endDate, page = '1', limit = '31' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 31;
    const skip = (pageNum - 1) * limitNum;

    const query: any = { companyId, employeeId };

    if (month && year) {
      const formattedMonth = String(month).padStart(2, '0');
      query.date = { $regex: `^${year}-${formattedMonth}` };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    sendSuccess(res, {
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    sendError(res, 'Failed to fetch personal attendance history.', 500);
  }
};
