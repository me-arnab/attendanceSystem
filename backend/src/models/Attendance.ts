import mongoose, { Document, Schema, Types } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'INCOMPLETE';

export interface IAttendance extends Document {
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  date: string; // 'YYYY-MM-DD' representing company-local date
  checkIn?: Date;
  checkOut?: Date;
  status: AttendanceStatus;
  workingMinutes: number;
  isManualCorrection: boolean;
  correctionReason?: string;
  correctedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      index: true, // Format: YYYY-MM-DD
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'LATE', 'ABSENT', 'INCOMPLETE'],
      default: 'INCOMPLETE',
      index: true,
    },
    workingMinutes: {
      type: Number,
      default: 0,
    },
    isManualCorrection: {
      type: Boolean,
      default: false,
    },
    correctionReason: {
      type: String,
      default: '',
      trim: true,
    },
    correctedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: One attendance record per employee per company per calendar date
AttendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
