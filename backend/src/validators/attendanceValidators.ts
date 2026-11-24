import { z } from 'zod';

export const manualCorrectionSchema = z.object({
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'INCOMPLETE']),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  reason: z.string().min(5, 'A reason of at least 5 characters is required for manual correction'),
});

export const attendanceFilterSchema = z.object({
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'INCOMPLETE']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
