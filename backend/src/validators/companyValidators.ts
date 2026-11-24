import { z } from 'zod';

export const isValidTimezone = (tz: string): boolean => {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const timezoneSchema = z
  .string()
  .refine(isValidTimezone, { message: 'Invalid IANA timezone identifier' });

export const companySettingsSchema = z.object({
  timezone: timezoneSchema.default('UTC'),
  officeStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)').default('09:00'),
  officeEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)').default('18:00'),
  workingDays: z.array(z.string()).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  lateThresholdMinutes: z.number().int().min(0).max(180).default(15),
  attendanceMode: z.enum(['AUTO_ON_LOGIN', 'MANUAL_PUNCH', 'DISABLED']).default('AUTO_ON_LOGIN'),
  requireCheckOut: z.boolean().default(true),
  breakDurationMinutes: z.number().int().min(0).max(480).default(0),
  halfDayThresholdHours: z.number().min(0).max(24).default(4),
  overtimeThresholdHours: z.number().min(0).max(24).default(9),
  autoCheckoutHoursAfterEnd: z.number().min(0).max(24).default(2),
  logoUrl: z.string().optional(),
});

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Valid company email is required'),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  code: z.string().min(2, 'Company code must be at least 2 characters').toUpperCase().optional(),
  adminFullName: z.string().min(2, 'Admin full name is required'),
  adminEmail: z.string().email('Valid admin email is required'),
  adminPassword: z.string().min(6, 'Admin password must be at least 6 characters'),
  timezone: timezoneSchema.default('UTC'),
  officeStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)').default('09:00'),
  officeEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)').default('18:00'),
  workingDays: z.array(z.string()).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  lateThresholdMinutes: z.number().int().min(0).max(180).default(15),
  attendanceMode: z.enum(['AUTO_ON_LOGIN', 'MANUAL_PUNCH', 'DISABLED']).default('AUTO_ON_LOGIN'),
  requireCheckOut: z.boolean().default(true),
  breakDurationMinutes: z.number().int().min(0).max(480).default(0),
  halfDayThresholdHours: z.number().min(0).max(24).default(4),
  overtimeThresholdHours: z.number().min(0).max(24).default(9),
  autoCheckoutHoursAfterEnd: z.number().min(0).max(24).default(2),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['active', 'suspended']).optional(),
  settings: z
    .object({
      timezone: timezoneSchema.optional(),
      officeStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      officeEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      workingDays: z.array(z.string()).optional(),
      lateThresholdMinutes: z.number().int().min(0).max(180).optional(),
      attendanceMode: z.enum(['AUTO_ON_LOGIN', 'MANUAL_PUNCH', 'DISABLED']).optional(),
      requireCheckOut: z.boolean().default(true).optional(),
      breakDurationMinutes: z.number().int().min(0).max(480).optional(),
      halfDayThresholdHours: z.number().min(0).max(24).optional(),
      overtimeThresholdHours: z.number().min(0).max(24).optional(),
      autoCheckoutHoursAfterEnd: z.number().min(0).max(24).optional(),
      logoUrl: z.string().optional(),
    })
    .optional(),
});

export const updatePlatformSettingsSchema = z.object({
  platformName: z.string().optional(),
  systemAnnouncement: z.string().optional(),
  maintenanceMode: z.boolean().optional(),
  allowSelfRegistration: z.boolean().optional(),
  allowRegistrations: z.boolean().optional(),
});
