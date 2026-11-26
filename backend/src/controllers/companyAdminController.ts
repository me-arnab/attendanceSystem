import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User, IUser } from '../models/User';
import { Department } from '../models/Department';
import { Attendance, AttendanceStatus } from '../models/Attendance';
import { Company } from '../models/Company';
import { AuditLog } from '../models/AuditLog';
import { createEmployeeSchema, updateEmployeeSchema } from '../validators/employeeValidators';
import { departmentSchema, updateDepartmentSchema } from '../validators/departmentValidators';
import { manualCorrectionSchema } from '../validators/attendanceValidators';
import { updateCompanySchema } from '../validators/companyValidators';
import { sendSuccess, sendError } from '../utils/response';
import { logAudit } from '../services/auditService';
import { getTimezoneDateInfo, isWorkingDay } from '../services/attendanceService';
import { isCompanyHoliday } from '../services/holidayService';

// Helper to get companyId securely from req.user
const getTenantId = (req: Request): Types.ObjectId => {
  return req.user!.companyId as Types.ObjectId;
};

/**
 * Company Admin Dashboard Metrics
 */
export const getDashboardMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const company = req.company || (await Company.findById(companyId));
    const timezone = company?.settings?.timezone || 'UTC';
    const workingDays = company?.settings?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const attendanceMode = company?.settings?.attendanceMode || 'AUTO_ON_LOGIN';

    const now = new Date();
    const todayInfo = getTimezoneDateInfo(now, timezone);
    const todayStr = todayInfo.dateString;
    const isTodayWorkDay = isWorkingDay(todayInfo.dayOfWeek, workingDays);
    const todayHolidayCheck = await isCompanyHoliday(companyId, todayStr);
    const isTodayHoliday = todayHolidayCheck.isHoliday;

    // Total active employees
    const totalEmployees = await User.countDocuments({
      companyId,
      role: 'EMPLOYEE',
      status: 'active',
    });

    // Today's attendance records for this company
    const todayRecords = await Attendance.find({
      companyId,
      date: todayStr,
    }).populate('employeeId', 'fullName email employeeId departmentId');

    const presentCount = todayRecords.filter((r) => r.status === 'PRESENT').length;
    const lateCount = todayRecords.filter((r) => r.status === 'LATE').length;
    const attendedCount = presentCount + lateCount;

    // Do not report 100% absence when company is closed, on holiday, or when attendance tracking is disabled
    const isAttendanceActiveToday = isTodayWorkDay && !isTodayHoliday && attendanceMode !== 'DISABLED';
    const absentCount = isAttendanceActiveToday ? Math.max(0, totalEmployees - attendedCount) : 0;

    const attendanceRate = totalEmployees > 0 && isAttendanceActiveToday
      ? Math.round((attendedCount / totalEmployees) * 100)
      : 0;

    // Trend for the last 7 days
    const trendDays: { date: string; present: number; late: number; absent: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dInfo = getTimezoneDateInfo(d, timezone);
      const dStr = dInfo.dateString;
      const isPastWorkDay = isWorkingDay(dInfo.dayOfWeek, workingDays);
      const pastHolidayCheck = await isCompanyHoliday(companyId, dStr);

      const dayRecords = await Attendance.find({ companyId, date: dStr });
      const p = dayRecords.filter((r) => r.status === 'PRESENT').length;
      const l = dayRecords.filter((r) => r.status === 'LATE').length;
      const attended = p + l;

      // On non-working days, holidays, or when attendance tracking is disabled, do not treat employees as absent
      const absent = (isPastWorkDay && !pastHolidayCheck.isHoliday && attendanceMode !== 'DISABLED')
        ? Math.max(0, totalEmployees - attended)
        : 0;

      trendDays.push({
        date: dStr.substring(5), // MM-DD
        present: p,
        late: l,
        absent,
      });
    }

    // Department summary
    const departments = await Department.find({ companyId, status: 'active' }).lean();
    const departmentSummary = await Promise.all(
      departments.map(async (dept) => {
        const count = await User.countDocuments({
          companyId,
          departmentId: dept._id,
          role: 'EMPLOYEE',
          status: 'active',
        });
        return {
          id: dept._id,
          name: dept.name,
          employeeCount: count,
        };
      })
    );

    // Recent 5 attendance logs today
    const recentActivity = await Attendance.find({ companyId })
      .sort({ updatedAt: -1 })
      .limit(6)
      .populate('employeeId', 'fullName email employeeId designation')
      .lean();

    sendSuccess(res, {
      stats: {
        totalEmployees,
        presentToday: presentCount,
        lateToday: lateCount,
        absentToday: absentCount,
        attendanceRate,
        todayDate: todayStr,
        isTodayHoliday,
        todayHolidayName: isTodayHoliday ? todayHolidayCheck.holiday?.name : null,
      },
      trend: trendDays,
      departmentSummary,
      recentActivity,
    });
  } catch (error: any) {
    console.error('[CompanyAdmin.getDashboardMetrics] Error:', error);
    sendError(res, 'Failed to fetch dashboard metrics.', 500);
  }
};

/**
 * Employees Management
 */
export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { search, departmentId, status, role, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const query: any = { companyId };

    if (departmentId && departmentId !== 'all') {
      query.departmentId = new Types.ObjectId(departmentId as string);
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (role && role !== 'all') {
      query.role = role;
    }
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const employees = await User.find(query)
      .select('-password')
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    sendSuccess(res, {
      employees,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('[CompanyAdmin.getEmployees] Error:', error);
    sendError(res, 'Failed to list employees.', 500);
  }
};

export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;

    const employee = await User.findOne({ _id: id, companyId })
      .select('-password')
      .populate('departmentId', 'name');

    if (!employee) {
      sendError(res, 'Employee not found in your company.', 404);
      return;
    }

    sendSuccess(res, employee);
  } catch (error: any) {
    sendError(res, 'Failed to fetch employee details.', 500);
  }
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const data = parsed.data;

    // Check unique email within this company (Tenant-scoped uniqueness)
    const existingCompanyEmail = await User.findOne({
      companyId,
      email: data.email.toLowerCase(),
    });
    if (existingCompanyEmail) {
      sendError(res, `Email '${data.email}' is already registered within your company.`, 409);
      return;
    }

    // Check unique email globally (Global identity safeguard)
    const existingEmail = await User.findOne({ email: data.email.toLowerCase() });
    if (existingEmail) {
      sendError(res, `Email '${data.email}' is already registered in the system.`, 409);
      return;
    }

    // Check unique employeeId within this company
    const existingEmpId = await User.findOne({ companyId, employeeId: data.employeeId });
    if (existingEmpId) {
      sendError(res, `Employee ID '${data.employeeId}' is already assigned within your company.`, 409);
      return;
    }

    // Validate department belongs to this company if provided
    let departmentObjId = null;
    if (data.departmentId) {
      const dept = await Department.findOne({ _id: data.departmentId, companyId });
      if (!dept) {
        sendError(res, 'Invalid department specified.', 400);
        return;
      }
      departmentObjId = dept._id;
    }

    const newEmployee = await User.create({
      companyId,
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      password: data.password,
      employeeId: data.employeeId,
      phone: data.phone || '',
      departmentId: departmentObjId,
      designation: data.designation || '',
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
      role: data.role || 'EMPLOYEE',
      status: data.status || 'active',
    });

    if (req.user) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'EMPLOYEE_CREATED',
        entityType: 'User',
        entityId: newEmployee._id.toString(),
        details: {
          employeeId: newEmployee.employeeId,
          fullName: newEmployee.fullName,
          email: newEmployee.email,
        },
      });
    }

    const result = newEmployee.toObject();
    delete (result as any).password;

    sendSuccess(res, result, 'Employee created successfully.', 201);
  } catch (error: any) {
    console.error('[CompanyAdmin.createEmployee] Error:', error);
    sendError(res, 'Failed to create employee.', 500);
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;

    const parsed = updateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const employee = await User.findOne({ _id: id, companyId });
    if (!employee) {
      sendError(res, 'Employee not found in your company.', 404);
      return;
    }

    const data = parsed.data;

    if (data.email && data.email.toLowerCase() !== employee.email) {
      // Check tenant-scoped email uniqueness
      const emailTakenInCompany = await User.findOne({
        companyId,
        email: data.email.toLowerCase(),
        _id: { $ne: employee._id },
      });
      if (emailTakenInCompany) {
        sendError(res, `Email '${data.email}' is already registered within your company.`, 409);
        return;
      }

      // Check global identity uniqueness
      const emailTaken = await User.findOne({
        email: data.email.toLowerCase(),
        _id: { $ne: employee._id },
      });
      if (emailTaken) {
        sendError(res, `Email '${data.email}' is already registered in the system.`, 409);
        return;
      }
      employee.email = data.email.toLowerCase();
    }

    if (data.employeeId && data.employeeId !== employee.employeeId) {
      const idTaken = await User.findOne({
        companyId,
        employeeId: data.employeeId,
        _id: { $ne: employee._id },
      });
      if (idTaken) {
        sendError(res, `Employee ID '${data.employeeId}' is already taken within your company.`, 409);
        return;
      }
      employee.employeeId = data.employeeId;
    }

    if (data.fullName) employee.fullName = data.fullName;
    if (data.phone !== undefined) employee.phone = data.phone;
    if (data.designation !== undefined) employee.designation = data.designation;
    if (data.joiningDate !== undefined) {
      employee.joiningDate = data.joiningDate ? new Date(data.joiningDate) : undefined;
    }

    // Role modification checks
    if (data.role && data.role !== employee.role) {
      if (employee.role === 'COMPANY_ADMIN' && data.role === 'EMPLOYEE') {
        if (req.user && req.user._id.toString() === employee._id.toString()) {
          sendError(res, 'You cannot change your own administrator role.', 403);
          return;
        }
        const activeAdminCount = await User.countDocuments({
          companyId,
          role: 'COMPANY_ADMIN',
          status: 'active',
        });
        if (activeAdminCount <= 1) {
          sendError(res, 'Cannot demote the last active administrator for this company.', 409);
          return;
        }
      }
      employee.role = data.role;
    }

    // Status modification checks
    if (data.status && data.status !== employee.status) {
      if (data.status === 'inactive') {
        // Prevent self-deactivation
        if (req.user && req.user._id.toString() === employee._id.toString()) {
          await logAudit({
            companyId,
            actorId: req.user._id,
            actorName: req.user.fullName,
            actorRole: req.user.role,
            action: 'REJECTED_SELF_DEACTIVATION',
            entityType: 'User',
            entityId: employee._id.toString(),
            details: {
              reason: 'Administrator attempted to deactivate their own account via update.',
              targetEmail: employee.email,
              targetRole: employee.role,
            },
          });
          sendError(res, 'You cannot deactivate your own administrator account.', 403);
          return;
        }

        // Protect the last active company admin
        if (employee.role === 'COMPANY_ADMIN') {
          const activeAdminCount = await User.countDocuments({
            companyId,
            role: 'COMPANY_ADMIN',
            status: 'active',
          });
          if (activeAdminCount <= 1) {
            if (req.user) {
              await logAudit({
                companyId,
                actorId: req.user._id,
                actorName: req.user.fullName,
                actorRole: req.user.role,
                action: 'REJECTED_LAST_ADMIN_DEACTIVATION',
                entityType: 'User',
                entityId: employee._id.toString(),
                details: {
                  reason: 'Cannot deactivate the last active administrator for this company.',
                  targetEmail: employee.email,
                  targetRole: employee.role,
                },
              });
            }
            sendError(res, 'Cannot deactivate the last active administrator for this company.', 409);
            return;
          }
        }
      }
      employee.status = data.status;
    }

    if (data.departmentId !== undefined) {
      if (data.departmentId) {
        const dept = await Department.findOne({ _id: data.departmentId, companyId });
        if (!dept) {
          sendError(res, 'Invalid department specified.', 400);
          return;
        }
        employee.departmentId = dept._id as any;
      } else {
        employee.departmentId = undefined;
      }
    }

    if (data.password) {
      employee.password = data.password;
    }

    await employee.save();

    if (req.user) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'User',
        entityId: employee._id.toString(),
        details: { updatedFields: Object.keys(data) },
      });
    }

    const result = employee.toObject();
    delete (result as any).password;

    sendSuccess(res, result, 'Employee updated successfully.');
  } catch (error: any) {
    console.error('[CompanyAdmin.updateEmployee] Error:', error);
    sendError(res, 'Failed to update employee.', 500);
  }
};

export const toggleEmployeeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      sendError(res, "Status must be 'active' or 'inactive'.", 400);
      return;
    }

    const employee = await User.findOne({ _id: id, companyId });
    if (!employee) {
      sendError(res, 'Employee not found.', 404);
      return;
    }

    // 1. PREVENT SELF-DEACTIVATION
    if (status === 'inactive' && req.user && req.user._id.toString() === employee._id.toString()) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'REJECTED_SELF_DEACTIVATION',
        entityType: 'User',
        entityId: employee._id.toString(),
        details: {
          reason: 'Administrator attempted to deactivate their own account.',
          targetEmail: employee.email,
          targetRole: employee.role,
        },
      });
      sendError(res, 'You cannot deactivate your own administrator account.', 403);
      return;
    }

    // 2. PROTECT THE LAST ACTIVE COMPANY ADMIN
    if (status === 'inactive' && employee.role === 'COMPANY_ADMIN') {
      const activeAdminCount = await User.countDocuments({
        companyId,
        role: 'COMPANY_ADMIN',
        status: 'active',
      });
      if (activeAdminCount <= 1) {
        if (req.user) {
          await logAudit({
            companyId,
            actorId: req.user._id,
            actorName: req.user.fullName,
            actorRole: req.user.role,
            action: 'REJECTED_LAST_ADMIN_DEACTIVATION',
            entityType: 'User',
            entityId: employee._id.toString(),
            details: {
              reason: 'Cannot deactivate the last active administrator for this company.',
              targetEmail: employee.email,
              targetRole: employee.role,
            },
          });
        }
        sendError(res, 'Cannot deactivate the last active administrator for this company.', 409);
        return;
      }
    }

    const previousStatus = employee.status;
    employee.status = status;
    await employee.save();

    if (req.user) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: status === 'inactive' ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
        entityType: 'User',
        entityId: employee._id.toString(),
        details: {
          previousStatus,
          newStatus: status,
          targetName: employee.fullName,
          targetEmail: employee.email,
          targetRole: employee.role,
        },
      });
    }

    sendSuccess(res, { id: employee._id, status: employee.status }, `Employee has been ${status === 'active' ? 'reactivated' : 'deactivated'}.`);
  } catch (error: any) {
    sendError(res, 'Failed to change employee status.', 500);
  }
};

/**
 * Departments Management
 */
export const getDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const departments = await Department.find({ companyId }).sort({ name: 1 }).lean();

    // Attach count of active employees in each department
    const enriched = await Promise.all(
      departments.map(async (dept) => {
        const count = await User.countDocuments({
          companyId,
          departmentId: dept._id,
          role: 'EMPLOYEE',
          status: 'active',
        });
        return {
          ...dept,
          employeeCount: count,
        };
      })
    );

    sendSuccess(res, enriched);
  } catch (error: any) {
    sendError(res, 'Failed to list departments.', 500);
  }
};

export const createDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const { name, description, status } = parsed.data;

    // Check unique department name for this company
    const existing = await Department.findOne({
      companyId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });
    if (existing) {
      sendError(res, `A department named '${name}' already exists in your company.`, 409);
      return;
    }

    const dept = await Department.create({
      companyId,
      name,
      description,
      status: status || 'active',
    });

    if (req.user) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: dept._id.toString(),
        details: { name: dept.name },
      });
    }

    sendSuccess(res, dept, 'Department created successfully.', 201);
  } catch (error: any) {
    sendError(res, 'Failed to create department.', 500);
  }
};

export const updateDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;
    const parsed = updateDepartmentSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const dept = await Department.findOne({ _id: id, companyId });
    if (!dept) {
      sendError(res, 'Department not found.', 404);
      return;
    }

    const data = parsed.data;
    if (data.name && data.name.toLowerCase() !== dept.name.toLowerCase()) {
      const exists = await Department.findOne({
        companyId,
        name: { $regex: new RegExp(`^${data.name}$`, 'i') },
        _id: { $ne: dept._id },
      });
      if (exists) {
        sendError(res, `A department named '${data.name}' already exists.`, 409);
        return;
      }
      dept.name = data.name;
    }

    if (data.description !== undefined) dept.description = data.description;
    if (data.status) dept.status = data.status;

    await dept.save();

    if (req.user) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'Department',
        entityId: dept._id.toString(),
        details: data,
      });
    }

    sendSuccess(res, dept, 'Department updated successfully.');
  } catch (error: any) {
    sendError(res, 'Failed to update department.', 500);
  }
};

/**
 * Attendance Listing & Manual Correction
 */
export const getAttendanceList = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const {
      date,
      startDate,
      endDate,
      departmentId,
      status,
      employeeId,
      page = '1',
      limit = '15',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const query: any = { companyId };

    if (date) {
      query.date = date;
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (employeeId) {
      query.employeeId = new Types.ObjectId(employeeId as string);
    }

    // If filtering by department, find matching employee IDs first
    if (departmentId && departmentId !== 'all') {
      const deptEmployees = await User.find({
        companyId,
        departmentId: new Types.ObjectId(departmentId as string),
      }).select('_id');
      const deptEmpIds = deptEmployees.map((e) => e._id);
      query.employeeId = { $in: deptEmpIds };
    }

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .populate({
        path: 'employeeId',
        select: 'fullName email employeeId designation departmentId',
        populate: { path: 'departmentId', select: 'name' },
      })
      .populate('correctedBy', 'fullName role')
      .sort({ date: -1, checkIn: -1 })
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
    console.error('[CompanyAdmin.getAttendanceList] Error:', error);
    sendError(res, 'Failed to fetch attendance records.', 500);
  }
};

/**
 * Manual Attendance Correction (Requires Reason and Audit Log)
 */
export const correctAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { id } = req.params;

    const parsed = manualCorrectionSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const { status, checkIn, checkOut, reason } = parsed.data;

    const attendance = await Attendance.findOne({ _id: id, companyId });
    if (!attendance) {
      sendError(res, 'Attendance record not found.', 404);
      return;
    }

    const previousState = {
      status: attendance.status,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      workingMinutes: attendance.workingMinutes,
    };

    attendance.status = status as AttendanceStatus;
    if (checkIn) attendance.checkIn = new Date(checkIn);
    if (checkOut) attendance.checkOut = new Date(checkOut);

    // Recalculate working minutes if checkIn and checkOut exist
    if (attendance.checkIn && attendance.checkOut) {
      const diffMs = attendance.checkOut.getTime() - attendance.checkIn.getTime();
      attendance.workingMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
    }

    attendance.isManualCorrection = true;
    attendance.correctionReason = reason;
    attendance.correctedBy = req.user!._id as any;

    await attendance.save();

    // Log Audit
    if (req.user) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'ATTENDANCE_MANUAL_CORRECTION',
        entityType: 'Attendance',
        entityId: attendance._id.toString(),
        details: {
          attendanceDate: attendance.date,
          employeeId: attendance.employeeId,
          reason,
          previousState,
          newState: {
            status: attendance.status,
            checkIn: attendance.checkIn,
            checkOut: attendance.checkOut,
            workingMinutes: attendance.workingMinutes,
          },
        },
      });
    }

    sendSuccess(res, attendance, 'Attendance record corrected successfully.');
  } catch (error: any) {
    console.error('[CompanyAdmin.correctAttendance] Error:', error);
    sendError(res, 'Failed to correct attendance record.', 500);
  }
};

/**
 * Company Reports Generation
 */
export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const { type = 'daily', date, month, year, departmentId, employeeId } = req.query;

    const company = req.company || (await Company.findById(companyId));
    const timezone = company?.settings?.timezone || 'UTC';
    const now = new Date();
    const todayStr = getTimezoneDateInfo(now, timezone).dateString;

    const query: any = { companyId };

    if (type === 'daily') {
      const targetDate = (date as string) || todayStr;
      query.date = targetDate;
    } else if (type === 'monthly') {
      const targetMonth = month || String(now.getMonth() + 1).padStart(2, '0');
      const targetYear = year || String(now.getFullYear());
      // Regex for YYYY-MM
      query.date = { $regex: `^${targetYear}-${targetMonth}` };
    }

    if (employeeId) {
      query.employeeId = new Types.ObjectId(employeeId as string);
    }

    if (departmentId && departmentId !== 'all') {
      const deptEmployees = await User.find({
        companyId,
        departmentId: new Types.ObjectId(departmentId as string),
      }).select('_id');
      query.employeeId = { $in: deptEmployees.map((e) => e._id) };
    }

    const records = await Attendance.find(query)
      .populate({
        path: 'employeeId',
        select: 'fullName email employeeId designation departmentId',
        populate: { path: 'departmentId', select: 'name' },
      })
      .sort({ date: -1 })
      .lean();

    // Summary calculations
    const totalRecords = records.length;
    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const incompleteCount = records.filter((r) => r.status === 'INCOMPLETE').length;

    const totalWorkingMinutes = records.reduce((sum, r) => sum + (r.workingMinutes || 0), 0);
    const avgWorkingHours = totalRecords > 0 ? (totalWorkingMinutes / totalRecords / 60).toFixed(1) : '0';

    sendSuccess(res, {
      summary: {
        totalRecords,
        presentCount,
        lateCount,
        absentCount,
        incompleteCount,
        avgWorkingHours,
      },
      records,
    });
  } catch (error: any) {
    console.error('[CompanyAdmin.getReports] Error:', error);
    sendError(res, 'Failed to generate attendance report.', 500);
  }
};

/**
 * Company Settings Management
 */
export const getCompanySettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const company = await Company.findById(companyId);
    if (!company) {
      sendError(res, 'Company not found.', 404);
      return;
    }
    sendSuccess(res, company);
  } catch (error: any) {
    sendError(res, 'Failed to fetch company settings.', 500);
  }
};

export const updateCompanySettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const parsed = updateCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const company = await Company.findById(companyId);
    if (!company) {
      sendError(res, 'Company not found.', 404);
      return;
    }

    const data = parsed.data;
    if (data.name) company.name = data.name;
    if (data.email) company.email = data.email;
    if (data.phone !== undefined) company.phone = data.phone;
    if (data.address !== undefined) company.address = data.address;

    if (data.settings) {
      const existingSettings = company.toObject().settings || {};
      company.settings = {
        ...existingSettings,
        ...data.settings,
      } as any;
    }

    await company.save();

    if (req.user) {
      await logAudit({
        companyId,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'COMPANY_SETTINGS_UPDATED',
        entityType: 'Company',
        entityId: company._id.toString(),
        details: data,
      });
    }

    sendSuccess(res, company, 'Company settings updated successfully.');
  } catch (error: any) {
    console.error('[CompanyAdmin.updateCompanySettings] Error:', error);
    sendError(res, 'Failed to update company settings.', 500);
  }
};

/**
 * Audit Logs for this company
 */
export const getCompanyAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = getTenantId(req);
    const logs = await AuditLog.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    sendSuccess(res, logs);
  } catch (error: any) {
    sendError(res, 'Failed to fetch audit logs.', 500);
  }
};
