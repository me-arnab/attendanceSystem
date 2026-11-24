import { z } from 'zod';

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters'),
  description: z.string().optional().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
