import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Holiday } from '../models/Holiday';
import { Company } from '../models/Company';
import {
  getCompanyHolidays,
  getUpcomingHolidays,
  checkHolidayConflict,
  resolveHolidayForYear,
} from '../services/holidayService';
import { getTimezoneDateInfo } from '../services/attendanceService';
import { createHolidaySchema, updateHolidaySchema } from '../validators/holidayValidators';
import { logAudit } from '../services/auditService';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Helper to safely extract tenant ID from authenticated request.
 * Never trust companyId from request body or client headers!
 */
const getTenantId = (req: Request): Types.ObjectId => {
  const cId = req.user?.companyId || req.company?._id;
  if (!cId) {
    const error: any = new Error('Tenant context missing from authenticated session.');
    error.statusCode = 403;
    throw error;
  }
  return new Types.ObjectId(cId.toString());
};

/**
 * GET /api/company/holidays
 * List company holidays resolved for a target year/month.
 */
export const getCompanyHolidaysHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { year, month, search } = req.query;

    const parsedYear = year ? parseInt(year as string, 10) : undefined;
    const parsedMonth = month ? parseInt(month as string, 10) : undefined;

    const holidays = await getCompanyHolidays(companyId, {
      year: parsedYear,
      month: parsedMonth,
      search: search as string,
    });

    sendSuccess(res, holidays);
  } catch (error: any) {
    console.error('[HolidayController.getCompanyHolidays] Error:', error);
    sendError(res, error.message || 'Failed to fetch company holidays.', error.statusCode || 500);
  }
};

/**
 * POST /api/company/holidays
 * Create a new holiday for the authenticated company.
 */
export const createHolidayHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const actorId = req.user!._id;
    const actorName = req.user!.fullName;
    const actorRole = req.user!.role;

    // Validate body
    const validated = createHolidaySchema.parse(req.body);

    // Prevent accidental duplicates for same tenant and date range
    const conflict = await checkHolidayConflict(
      companyId,
      validated.date,
      validated.endDate
    );

    if (conflict.hasConflict) {
      sendError(
        res,
        `A holiday already exists for this date range: "${conflict.conflictingHolidayName}"`,
        400
      );
      return;
    }

    const holiday = await Holiday.create({
      companyId,
      name: validated.name,
      description: validated.description || '',
      date: validated.date,
      endDate: validated.endDate || null,
      holidayType: validated.holidayType,
      isRecurring: validated.isRecurring,
      createdBy: actorId,
    });

    // Record audit log
    await logAudit({
      companyId,
      actorId,
      actorName,
      actorRole,
      action: 'CREATE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id.toString(),
      details: {
        name: holiday.name,
        date: holiday.date,
        endDate: holiday.endDate,
        holidayType: holiday.holidayType,
        isRecurring: holiday.isRecurring,
      },
      ipAddress: req.ip,
    });

    sendSuccess(res, holiday, 'Holiday created successfully.', 201);
  } catch (error: any) {
    console.error('[HolidayController.createHoliday] Error:', error);
    sendError(res, error.message || 'Failed to create holiday.', error.statusCode || 400);
  }
};

/**
 * PUT /api/company/holidays/:id
 * Update an existing company holiday.
 */
export const updateHolidayHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;
    const actorId = req.user!._id;
    const actorName = req.user!.fullName;
    const actorRole = req.user!.role;

    if (!Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid holiday identifier.', 400);
      return;
    }

    // Tenant-isolated lookup
    const holiday = await Holiday.findOne({ _id: id, companyId });
    if (!holiday) {
      sendError(res, 'Holiday not found in your organization.', 404);
      return;
    }

    const validated = updateHolidaySchema.parse(req.body);

    const newDate = validated.date || holiday.date;
    const newEndDate = validated.endDate !== undefined ? validated.endDate : holiday.endDate;

    // Check conflict if date changed
    if (newDate !== holiday.date || newEndDate !== holiday.endDate) {
      const conflict = await checkHolidayConflict(companyId, newDate, newEndDate, id);
      if (conflict.hasConflict) {
        sendError(
          res,
          `A holiday already exists for this date range: "${conflict.conflictingHolidayName}"`,
          400
        );
        return;
      }
    }

    if (validated.name !== undefined) holiday.name = validated.name;
    if (validated.description !== undefined) holiday.description = validated.description;
    if (validated.date !== undefined) holiday.date = validated.date;
    if (validated.endDate !== undefined) holiday.endDate = validated.endDate || undefined;
    if (validated.holidayType !== undefined) holiday.holidayType = validated.holidayType;
    if (validated.isRecurring !== undefined) holiday.isRecurring = validated.isRecurring;

    await holiday.save();

    await logAudit({
      companyId,
      actorId,
      actorName,
      actorRole,
      action: 'UPDATE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id.toString(),
      details: {
        name: holiday.name,
        date: holiday.date,
        endDate: holiday.endDate,
        holidayType: holiday.holidayType,
        isRecurring: holiday.isRecurring,
      },
      ipAddress: req.ip,
    });

    sendSuccess(res, holiday, 'Holiday updated successfully.');
  } catch (error: any) {
    console.error('[HolidayController.updateHoliday] Error:', error);
    sendError(res, error.message || 'Failed to update holiday.', error.statusCode || 400);
  }
};

/**
 * DELETE /api/company/holidays/:id
 * Delete a holiday from the authenticated company.
 */
export const deleteHolidayHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;
    const actorId = req.user!._id;
    const actorName = req.user!.fullName;
    const actorRole = req.user!.role;

    if (!Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid holiday identifier.', 400);
      return;
    }

    // Tenant-isolated find and delete
    const holiday = await Holiday.findOneAndDelete({ _id: id, companyId });
    if (!holiday) {
      sendError(res, 'Holiday not found in your organization.', 404);
      return;
    }

    await logAudit({
      companyId,
      actorId,
      actorName,
      actorRole,
      action: 'DELETE_HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id.toString(),
      details: {
        name: holiday.name,
        date: holiday.date,
      },
      ipAddress: req.ip,
    });

    sendSuccess(res, { id: holiday._id }, 'Holiday deleted successfully.');
  } catch (error: any) {
    console.error('[HolidayController.deleteHoliday] Error:', error);
    sendError(res, error.message || 'Failed to delete holiday.', error.statusCode || 500);
  }
};

/**
 * GET /api/employee/holidays
 * Read-only holiday list for the authenticated employee's company.
 */
export const getEmployeeHolidaysHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { year, month, search } = req.query;

    const parsedYear = year ? parseInt(year as string, 10) : undefined;
    const parsedMonth = month ? parseInt(month as string, 10) : undefined;

    const holidays = await getCompanyHolidays(companyId, {
      year: parsedYear,
      month: parsedMonth,
      search: search as string,
    });

    sendSuccess(res, holidays);
  } catch (error: any) {
    console.error('[HolidayController.getEmployeeHolidays] Error:', error);
    sendError(res, error.message || 'Failed to fetch employee holidays.', error.statusCode || 500);
  }
};

/**
 * GET /api/employee/holidays/upcoming
 * Returns upcoming holidays for the authenticated employee's company.
 */
export const getEmployeeUpcomingHolidaysHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const company = req.company || (await Company.findById(companyId));
    const timezone = company?.settings?.timezone || 'UTC';

    const now = new Date();
    const todayStr = getTimezoneDateInfo(now, timezone).dateString;

    const upcoming = await getUpcomingHolidays(companyId, todayStr, 5);
    sendSuccess(res, upcoming);
  } catch (error: any) {
    console.error('[HolidayController.getEmployeeUpcomingHolidays] Error:', error);
    sendError(res, error.message || 'Failed to fetch upcoming holidays.', error.statusCode || 500);
  }
};
