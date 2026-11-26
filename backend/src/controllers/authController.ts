import { Request, Response } from 'express';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { loginSchema, changePasswordSchema } from '../validators/authValidators';
import { signToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { processLoginAttendance, getTimezoneDateInfo } from '../services/attendanceService';
import { Attendance } from '../models/Attendance';
import { logAudit } from '../services/auditService';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'Invalid credentials provided.', 422, parseResult.error.issues);
      return;
    }

    const { email, password } = parseResult.data;

    // Find user by lowercase email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      sendError(res, 'Invalid email or password.', 401);
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendError(res, 'Invalid email or password.', 401);
      return;
    }

    // Check account status
    if (user.status !== 'active') {
      sendError(res, 'Your account has been deactivated. Please contact your administrator.', 403);
      return;
    }

    let company = null;
    let todayAttendance = null;

    if (user.role !== 'SUPER_ADMIN') {
      if (!user.companyId) {
        sendError(res, 'Account is not associated with any registered company.', 403);
        return;
      }

      company = await Company.findById(user.companyId);
      if (!company) {
        sendError(res, 'Associated company record not found.', 403);
        return;
      }

      if (company.status === 'suspended') {
        sendError(res, 'Your company account is suspended. Please contact platform support.', 403);
        return;
      }

      // If user is an EMPLOYEE: automatically process daily attendance check-in!
      if (user.role === 'EMPLOYEE') {
        const attendanceResult = await processLoginAttendance(user, company);
        todayAttendance = attendanceResult.attendance;
      }
    }

    // Generate token
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId ? user.companyId.toString() : undefined,
    });

    sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId,
          phone: user.phone,
          departmentId: user.departmentId,
          designation: user.designation,
          status: user.status,
          joiningDate: user.joiningDate,
        },
        company: company
          ? {
              id: company._id,
              name: company.name,
              code: company.code,
              status: company.status,
              settings: company.settings,
            }
          : null,
        todayAttendance,
      },
      'Login successful'
    );
  } catch (error: any) {
    console.error('[AuthController.login] Error:', error);
    sendError(res, 'Login processing failed. Please try again.', 500);
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Not authenticated', 401);
      return;
    }

    let todayAttendance = null;
    if (req.user.role === 'EMPLOYEE' && req.company) {
      const tz = req.company.settings?.timezone || 'UTC';
      const tzInfo = getTimezoneDateInfo(new Date(), tz);
      todayAttendance = await Attendance.findOne({
        companyId: req.company._id,
        employeeId: req.user._id,
        date: tzInfo.dateString,
      });
    }

    sendSuccess(res, {
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
        employeeId: req.user.employeeId,
        phone: req.user.phone,
        departmentId: req.user.departmentId,
        designation: req.user.designation,
        status: req.user.status,
        joiningDate: req.user.joiningDate,
      },
      company: req.company
        ? {
            id: req.company._id,
            name: req.company.name,
            code: req.company.code,
            email: req.company.email,
            phone: req.company.phone,
            address: req.company.address,
            status: req.company.status,
            settings: req.company.settings,
          }
        : null,
      todayAttendance,
    });
  } catch (error: any) {
    console.error('[AuthController.getMe] Error:', error);
    sendError(res, 'Failed to retrieve current user.', 500);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, null, 'Logged out successfully');
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    // Role check: Allow COMPANY_ADMIN, EMPLOYEE, and SUPER_ADMIN
    const allowedRoles = ['COMPANY_ADMIN', 'EMPLOYEE', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 'Unauthorized to perform password change.', 403);
      return;
    }

    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'Invalid password data provided.';
      sendError(res, errorMsg, 400, parseResult.error.issues);
      return;
    }

    const { currentPassword, newPassword } = parseResult.data;

    // Identify user exclusively from authenticated JWT user ID
    const user = await User.findById(req.user._id);
    if (!user) {
      sendError(res, 'User account not found.', 404);
      return;
    }

    if (user.status !== 'active') {
      sendError(res, 'Account is inactive. Password change is disabled.', 403);
      return;
    }

    // Verify current password using bcrypt
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      sendError(res, 'Incorrect current password.', 400);
      return;
    }

    // Verify new password is not identical to current password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      sendError(res, 'New password cannot be identical to your current password.', 400);
      return;
    }

    // Update password (pre('save') hook handles bcrypt hashing)
    user.password = newPassword;
    await user.save();

    // Audit log without passwords or sensitive tokens
    await logAudit({
      companyId: user.companyId || null,
      actorId: user._id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'CHANGE_PASSWORD',
      entityType: 'User',
      entityId: user._id.toString(),
      details: {
        email: user.email,
        role: user.role,
      },
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'Password changed successfully.');
  } catch (error: any) {
    console.error('[AuthController.changePassword] Error:', error);
    sendError(res, 'Failed to update password. Please try again.', 500);
  }
};
