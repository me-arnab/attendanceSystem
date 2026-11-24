import mongoose, { Document, Schema, Types } from 'mongoose';

export type HolidayType = 'NATIONAL' | 'REGIONAL' | 'COMPANY' | 'OPTIONAL';

export interface IHoliday extends Document {
  companyId: Types.ObjectId;
  name: string;
  description?: string;
  date: string; // 'YYYY-MM-DD' representing holiday start date
  endDate?: string; // Optional 'YYYY-MM-DD' for multi-day holidays
  holidayType: HolidayType;
  isRecurring: boolean; // Repeats annually on the same month & day
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
      maxlength: [100, 'Holiday name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Holiday description cannot exceed 500 characters'],
      default: '',
    },
    date: {
      type: String,
      required: [true, 'Holiday start date is required'],
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
      index: true,
    },
    endDate: {
      type: String,
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'End date must be formatted as YYYY-MM-DD'],
      default: null,
    },
    holidayType: {
      type: String,
      enum: ['NATIONAL', 'REGIONAL', 'COMPANY', 'OPTIONAL'],
      default: 'COMPANY',
    },
    isRecurring: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for tenant-scoped date queries and uniqueness
HolidaySchema.index({ companyId: 1, date: 1 });
HolidaySchema.index({ companyId: 1, isRecurring: 1 });
HolidaySchema.index({ companyId: 1, date: 1, name: 1 }, { unique: true });

export const Holiday = mongoose.model<IHoliday>('Holiday', HolidaySchema);
