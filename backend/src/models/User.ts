import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE';
export type UserStatus = 'active' | 'inactive';

export interface IUser extends Document {
  companyId?: Types.ObjectId;
  fullName: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  employeeId?: string;
  phone?: string;
  departmentId?: Types.ObjectId;
  designation?: string;
  joiningDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'EMPLOYEE'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    employeeId: {
      type: String,
      trim: true,
      default: null,
    },
    phone: { type: String, default: '', trim: true },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    designation: { type: String, default: '', trim: true },
    joiningDate: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique employeeId within the same company
UserSchema.index(
  { companyId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeId: { $type: 'string', $gt: '' },
      companyId: { $type: 'objectId' },
    },
  }
);

// Compound index for tenant-scoped email uniqueness within each company
UserSchema.index(
  { companyId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $type: 'objectId' },
    },
  }
);

// Pre-save password hash
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// Compare password helper
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);
