import { z } from 'zod';

export const createEmployeeSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  phone: z.string().optional().default(''),
  departmentId: z.string().optional().nullable(),
  designation: z.string().optional().default(''),
  joiningDate: z.string().optional().nullable(), // ISO string
  role: z.enum(['EMPLOYEE', 'COMPANY_ADMIN']).default('EMPLOYEE'),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateEmployeeSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  employeeId: z.string().min(1).optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional().nullable(),
  designation: z.string().optional(),
  joiningDate: z.string().optional().nullable(),
  role: z.enum(['EMPLOYEE', 'COMPANY_ADMIN']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(6).optional(), // optional password update
});
