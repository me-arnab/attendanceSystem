import { Request, Response } from 'express';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { PlatformSetting, getOrCreatePlatformSettings } from '../models/PlatformSetting';
import { createCompanySchema, updateCompanySchema } from '../validators/companyValidators';
import { sendSuccess, sendError } from '../utils/response';
import { logAudit } from '../services/auditService';
import { getTimezoneDateInfo } from '../services/attendanceService';

/**
 * Super Admin Dashboard Overview
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalCompanies = await Company.countDocuments();
    const activeCompanies = await Company.countDocuments({ status: 'active' });
    const suspendedCompanies = await Company.countDocuments({ status: 'suspended' });

    // Total employees across all companies (excluding super admins)
    const totalEmployees = await User.countDocuments({ role: { $ne: 'SUPER_ADMIN' } });

    // Today's total attendances across all companies
    const todayUTC = getTimezoneDateInfo(new Date(), 'UTC').dateString;
    const todayAttendanceCount = await Attendance.countDocuments({ date: todayUTC });

    // Monthly breakdown of new companies (past 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const companiesByMonth = await Company.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Format month labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyGrowth = companiesByMonth.map((item) => ({
      name: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      companies: item.count,
    }));

    // Recent registered companies with admin details
    const recentCompanies = await Company.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentWithDetails = await Promise.all(
      recentCompanies.map(async (comp) => {
        const admin = await User.findOne({ companyId: comp._id, role: 'COMPANY_ADMIN' }).select('fullName email phone');
        const employeeCount = await User.countDocuments({ companyId: comp._id, role: 'EMPLOYEE' });
        return {
          ...comp,
          admin,
          employeeCount,
        };
      })
    );

    sendSuccess(res, {
      stats: {
        totalCompanies,
        activeCompanies,
        suspendedCompanies,
        totalEmployees,
        todayAttendance: todayAttendanceCount,
      },
      monthlyGrowth,
      recentCompanies: recentWithDetails,
    });
  } catch (error: any) {
    console.error('[SuperAdminController.getDashboardStats] Error:', error);
    sendError(res, 'Failed to fetch platform dashboard stats.', 500);
  }
};

/**
 * List all companies with search, filter, and pagination
 */
export const getCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Company.countDocuments(query);
    const companies = await Company.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Populate company admin and employee count for each company
    const enrichedCompanies = await Promise.all(
      companies.map(async (comp) => {
        const admin = await User.findOne({ companyId: comp._id, role: 'COMPANY_ADMIN' })
          .select('fullName email phone status')
          .lean();
        const employeeCount = await User.countDocuments({
          companyId: comp._id,
          role: 'EMPLOYEE',
        });
        return {
          ...comp,
          admin,
          employeeCount,
        };
      })
    );

    sendSuccess(res, {
      companies: enrichedCompanies,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('[SuperAdminController.getCompanies] Error:', error);
    sendError(res, 'Failed to retrieve companies.', 500);
  }
};

/**
 * Get single company details
 */
export const getCompanyDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).lean();
    if (!company) {
      sendError(res, 'Company not found.', 404);
      return;
    }

    const admin = await User.findOne({ companyId: company._id, role: 'COMPANY_ADMIN' })
      .select('-password')
      .lean();

    const employeeCount = await User.countDocuments({ companyId: company._id, role: 'EMPLOYEE' });

    sendSuccess(res, {
      company,
      admin,
      employeeCount,
    });
  } catch (error: any) {
    console.error('[SuperAdminController.getCompanyDetails] Error:', error);
    sendError(res, 'Failed to fetch company details.', 500);
  }
};

/**
 * Create a new Company and its initial Company Admin
 */
export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const data = parsed.data;

    // Check if company code already exists
    let companyCode = data.code;
    if (!companyCode) {
      // Auto-generate code from name
      const cleanName = data.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      companyCode = `${cleanName}-${randomSuffix}`;
    }

    const existingCode = await Company.findOne({ code: companyCode });
    if (existingCode) {
      sendError(res, `Company code '${companyCode}' is already in use. Please provide a unique code.`, 409);
      return;
    }

    // Check if admin email already exists
    const existingAdminEmail = await User.findOne({ email: data.adminEmail.toLowerCase() });
    if (existingAdminEmail) {
      sendError(res, `Email '${data.adminEmail}' is already registered to an existing user account.`, 409);
      return;
    }

    // 1. Create company record
    const newCompany = await Company.create({
      name: data.name,
      code: companyCode,
      email: data.email,
      phone: data.phone || '',
      address: data.address || '',
      status: 'active',
      settings: {
        timezone: data.timezone || 'UTC',
        officeStartTime: data.officeStartTime || '09:00',
        officeEndTime: data.officeEndTime || '18:00',
        workingDays: data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        lateThresholdMinutes: data.lateThresholdMinutes ?? 15,
        attendanceMode: data.attendanceMode || 'AUTO_ON_LOGIN',
        requireCheckOut: data.requireCheckOut ?? true,
        breakDurationMinutes: data.breakDurationMinutes ?? 0,
        halfDayThresholdHours: data.halfDayThresholdHours ?? 4,
        overtimeThresholdHours: data.overtimeThresholdHours ?? 9,
        autoCheckoutHoursAfterEnd: data.autoCheckoutHoursAfterEnd ?? 2,
      },
    });

    // 2. Create initial Company Admin user account
    const newAdmin = await User.create({
      companyId: newCompany._id,
      fullName: data.adminFullName,
      email: data.adminEmail.toLowerCase(),
      password: data.adminPassword, // will be hashed by User pre-save hook
      role: 'COMPANY_ADMIN',
      status: 'active',
      phone: data.phone || '',
      designation: 'Company Administrator',
    });

    // 3. Log Audit
    if (req.user) {
      await logAudit({
        companyId: newCompany._id,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'COMPANY_CREATED',
        entityType: 'Company',
        entityId: newCompany._id.toString(),
        details: {
          companyName: newCompany.name,
          companyCode: newCompany.code,
          adminEmail: newAdmin.email,
        },
      });
    }

    sendSuccess(
      res,
      {
        company: newCompany,
        admin: {
          id: newAdmin._id,
          fullName: newAdmin.fullName,
          email: newAdmin.email,
          role: newAdmin.role,
        },
      },
      'Company and Company Admin successfully created.',
      201
    );
  } catch (error: any) {
    console.error('[SuperAdminController.createCompany] Error:', error);
    sendError(res, 'Failed to create company.', 500);
  }
};

/**
 * Update Company details or status
 */
export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = updateCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 'Validation error', 422, parsed.error.issues);
      return;
    }

    const company = await Company.findById(id);
    if (!company) {
      sendError(res, 'Company not found.', 404);
      return;
    }

    const prevStatus = company.status;
    const data = parsed.data;

    if (data.name) company.name = data.name;
    if (data.email) company.email = data.email;
    if (data.phone !== undefined) company.phone = data.phone;
    if (data.address !== undefined) company.address = data.address;
    if (data.status) company.status = data.status;

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
        companyId: company._id,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: data.status && data.status !== prevStatus
          ? data.status === 'suspended'
            ? 'COMPANY_SUSPENDED'
            : 'COMPANY_ACTIVATED'
          : 'COMPANY_UPDATED',
        entityType: 'Company',
        entityId: company._id.toString(),
        details: { updatedFields: Object.keys(data) },
      });
    }

    sendSuccess(res, company, 'Company successfully updated.');
  } catch (error: any) {
    console.error('[SuperAdminController.updateCompany] Error:', error);
    sendError(res, 'Failed to update company.', 500);
  }
};

/**
 * Toggle Company Status (Activate / Suspend)
 */
export const toggleCompanyStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      sendError(res, "Status must be either 'active' or 'suspended'.", 400);
      return;
    }

    const company = await Company.findById(id);
    if (!company) {
      sendError(res, 'Company not found.', 404);
      return;
    }

    company.status = status;
    await company.save();

    if (req.user) {
      await logAudit({
        companyId: company._id,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: status === 'suspended' ? 'COMPANY_SUSPENDED' : 'COMPANY_ACTIVATED',
        entityType: 'Company',
        entityId: company._id.toString(),
        details: { newStatus: status },
      });
    }

    sendSuccess(
      res,
      company,
      `Company has been successfully ${status === 'active' ? 'activated' : 'suspended'}.`
    );
  } catch (error: any) {
    console.error('[SuperAdminController.toggleCompanyStatus] Error:', error);
    sendError(res, 'Failed to change company status.', 500);
  }
};

/**
 * Platform settings (persisted in MongoDB via PlatformSetting singleton)
 */
export const getPlatformSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getOrCreatePlatformSettings();
    sendSuccess(res, {
      platformName: settings.platformName,
      systemAnnouncement: settings.systemAnnouncement,
      maintenanceMode: settings.maintenanceMode,
      allowSelfRegistration: settings.allowSelfRegistration,
    });
  } catch (error: any) {
    console.error('[SuperAdminController.getPlatformSettings] Error:', error);
    sendError(res, 'Failed to fetch platform settings.', 500);
  }
};

export const updatePlatformSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      platformName,
      systemAnnouncement,
      maintenanceMode,
      allowSelfRegistration,
      allowRegistrations,
    } = req.body;

    const updateFields: any = {};
    if (platformName !== undefined) updateFields.platformName = String(platformName).trim();
    if (systemAnnouncement !== undefined) updateFields.systemAnnouncement = String(systemAnnouncement).trim();
    if (maintenanceMode !== undefined) updateFields.maintenanceMode = Boolean(maintenanceMode);

    // Support both allowSelfRegistration and allowRegistrations for backwards compatibility
    const selfReg = allowSelfRegistration !== undefined ? allowSelfRegistration : allowRegistrations;
    if (selfReg !== undefined) updateFields.allowSelfRegistration = Boolean(selfReg);

    const updatedSettings = await PlatformSetting.findOneAndUpdate(
      { singletonKey: 'GLOBAL_SETTINGS' },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    if (req.user) {
      await logAudit({
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: 'PLATFORM_SETTINGS_UPDATED',
        entityType: 'PlatformSettings',
        entityId: updatedSettings._id.toString(),
        details: req.body,
      });
    }

    sendSuccess(
      res,
      {
        platformName: updatedSettings.platformName,
        systemAnnouncement: updatedSettings.systemAnnouncement,
        maintenanceMode: updatedSettings.maintenanceMode,
        allowSelfRegistration: updatedSettings.allowSelfRegistration,
      },
      'Platform settings updated successfully.'
    );
  } catch (error: any) {
    console.error('[SuperAdminController.updatePlatformSettings] Error:', error);
    sendError(res, 'Failed to update platform settings.', 500);
  }
};

/**
 * Toggle User Status (Activate / Deactivate) by Super Admin
 */
export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      sendError(res, "Status must be 'active' or 'inactive'.", 400);
      return;
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      sendError(res, 'User not found.', 404);
      return;
    }

    // 1. Prevent Super Admin from deactivating themselves
    if (status === 'inactive' && req.user && req.user._id.toString() === targetUser._id.toString()) {
      if (req.user) {
        await logAudit({
          companyId: targetUser.companyId || null,
          actorId: req.user._id,
          actorName: req.user.fullName,
          actorRole: req.user.role,
          action: 'REJECTED_SELF_DEACTIVATION',
          entityType: 'User',
          entityId: targetUser._id.toString(),
          details: {
            reason: 'Super Admin attempted to deactivate their own account.',
            targetEmail: targetUser.email,
            targetRole: targetUser.role,
          },
        });
      }
      sendError(res, 'You cannot deactivate your own Super Admin account.', 403);
      return;
    }

    // 2. Prevent deactivating the last active SUPER_ADMIN
    if (status === 'inactive' && targetUser.role === 'SUPER_ADMIN') {
      const activeSuperAdminCount = await User.countDocuments({
        role: 'SUPER_ADMIN',
        status: 'active',
      });
      if (activeSuperAdminCount <= 1) {
        if (req.user) {
          await logAudit({
            companyId: null,
            actorId: req.user._id,
            actorName: req.user.fullName,
            actorRole: req.user.role,
            action: 'REJECTED_LAST_ADMIN_DEACTIVATION',
            entityType: 'User',
            entityId: targetUser._id.toString(),
            details: {
              reason: 'Cannot deactivate the last active Super Admin. Platform must retain at least one active Super Admin.',
              targetEmail: targetUser.email,
              targetRole: targetUser.role,
            },
          });
        }
        sendError(
          res,
          'Cannot deactivate the last active Super Admin. The platform must retain at least one active Super Admin.',
          409
        );
        return;
      }
    }

    // 3. Prevent deactivating the last active COMPANY_ADMIN of a company
    if (status === 'inactive' && targetUser.role === 'COMPANY_ADMIN' && targetUser.companyId) {
      const activeCompanyAdminCount = await User.countDocuments({
        companyId: targetUser.companyId,
        role: 'COMPANY_ADMIN',
        status: 'active',
      });
      if (activeCompanyAdminCount <= 1) {
        if (req.user) {
          await logAudit({
            companyId: targetUser.companyId,
            actorId: req.user._id,
            actorName: req.user.fullName,
            actorRole: req.user.role,
            action: 'REJECTED_LAST_ADMIN_DEACTIVATION',
            entityType: 'User',
            entityId: targetUser._id.toString(),
            details: {
              reason: 'Cannot deactivate the last active administrator for this company.',
              targetEmail: targetUser.email,
              targetRole: targetUser.role,
            },
          });
        }
        sendError(res, 'Cannot deactivate the last active administrator for this company.', 409);
        return;
      }
    }

    const previousStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    if (req.user) {
      await logAudit({
        companyId: targetUser.companyId || null,
        actorId: req.user._id,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        action: status === 'inactive' ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
        entityType: 'User',
        entityId: targetUser._id.toString(),
        details: {
          previousStatus,
          newStatus: status,
          targetName: targetUser.fullName,
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
        },
      });
    }

    sendSuccess(
      res,
      { id: targetUser._id, status: targetUser.status },
      `User has been ${status === 'active' ? 'reactivated' : 'deactivated'}.`
    );
  } catch (error: any) {
    console.error('[SuperAdminController.toggleUserStatus] Error:', error);
    sendError(res, 'Failed to change user status.', 500);
  }
};
