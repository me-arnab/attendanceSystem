import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSetting extends Document {
  singletonKey: string;
  platformName: string;
  systemAnnouncement: string;
  maintenanceMode: boolean;
  allowSelfRegistration: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingSchema = new Schema<IPlatformSetting>(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: 'GLOBAL_SETTINGS',
      immutable: true,
      index: true,
    },
    platformName: {
      type: String,
      required: [true, 'Platform name is required'],
      trim: true,
      default: 'Antigravity Attendance SaaS Platform',
    },
    systemAnnouncement: {
      type: String,
      trim: true,
      default: 'Welcome to the Enterprise Attendance Management System.',
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    allowSelfRegistration: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const PlatformSetting = mongoose.model<IPlatformSetting>(
  'PlatformSetting',
  PlatformSettingSchema
);

/**
 * Safely fetches the singleton platform settings document,
 * initializing it atomically with default values on first access.
 */
export const getOrCreatePlatformSettings = async (): Promise<IPlatformSetting> => {
  const settings = await PlatformSetting.findOneAndUpdate(
    { singletonKey: 'GLOBAL_SETTINGS' },
    {
      $setOnInsert: {
        platformName: 'Antigravity Attendance SaaS Platform',
        systemAnnouncement: 'Welcome to the Enterprise Attendance Management System.',
        maintenanceMode: false,
        allowSelfRegistration: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return settings;
};
