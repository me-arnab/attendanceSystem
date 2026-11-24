import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceMode = 'AUTO_ON_LOGIN' | 'MANUAL_PUNCH' | 'DISABLED';

export interface ICompanySettings {
  timezone: string;
  officeStartTime: string; // 'HH:mm' 24-hr format, e.g. "09:00"
  officeEndTime: string;   // 'HH:mm' 24-hr format, e.g. "18:00"
  workingDays: string[];   // e.g. ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  lateThresholdMinutes: number; // e.g. 15
  attendanceMode: AttendanceMode;
  requireCheckOut: boolean;
  breakDurationMinutes: number;
  halfDayThresholdHours: number;
  overtimeThresholdHours: number;
  autoCheckoutHoursAfterEnd: number;
  logoUrl?: string;
}

export interface ICompany extends Document {
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'suspended';
  settings: ICompanySettings;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySettingsSchema = new Schema<ICompanySettings>(
  {
    timezone: { type: String, default: 'UTC', trim: true },
    officeStartTime: { type: String, default: '09:00', trim: true },
    officeEndTime: { type: String, default: '18:00', trim: true },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    lateThresholdMinutes: { type: Number, default: 15 },
    attendanceMode: {
      type: String,
      enum: ['AUTO_ON_LOGIN', 'MANUAL_PUNCH', 'DISABLED'],
      default: 'AUTO_ON_LOGIN',
    },
    requireCheckOut: { type: Boolean, default: true },
    breakDurationMinutes: { type: Number, default: 0 },
    halfDayThresholdHours: { type: Number, default: 4 },
    overtimeThresholdHours: { type: Number, default: 9 },
    autoCheckoutHoursAfterEnd: { type: Number, default: 2 },
    logoUrl: { type: String, trim: true },
  },
  { _id: false }
);

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    settings: {
      type: CompanySettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

export const Company = mongoose.model<ICompany>('Company', CompanySchema);
