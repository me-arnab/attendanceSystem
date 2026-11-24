import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createHolidaySchema = z
  .object({
    name: z.string().min(2, 'Holiday name must be at least 2 characters').max(100),
    description: z.string().max(500).optional().default(''),
    date: z.string().regex(DATE_REGEX, 'Start date must be in YYYY-MM-DD format'),
    endDate: z.string().regex(DATE_REGEX, 'End date must be in YYYY-MM-DD format').optional().nullable(),
    holidayType: z.enum(['NATIONAL', 'REGIONAL', 'COMPANY', 'OPTIONAL']).default('COMPANY'),
    isRecurring: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (!data.endDate) return true;
      return data.endDate >= data.date;
    },
    {
      message: 'End date must be equal to or after start date',
      path: ['endDate'],
    }
  );

export const updateHolidaySchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    date: z.string().regex(DATE_REGEX, 'Start date must be in YYYY-MM-DD format').optional(),
    endDate: z.string().regex(DATE_REGEX, 'End date must be in YYYY-MM-DD format').optional().nullable(),
    holidayType: z.enum(['NATIONAL', 'REGIONAL', 'COMPANY', 'OPTIONAL']).optional(),
    isRecurring: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.date && data.endDate) {
        return data.endDate >= data.date;
      }
      return true;
    },
    {
      message: 'End date must be equal to or after start date',
      path: ['endDate'],
    }
  );
