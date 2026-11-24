import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/\d/, 'New password must contain at least one number')
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/,
        'New password must contain at least one special character'
      ),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password cannot be identical to your current password',
    path: ['newPassword'],
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== '') {
        return data.newPassword === data.confirmPassword;
      }
      return true;
    },
    {
      message: 'New password and confirm password do not match',
      path: ['confirmPassword'],
    }
  );

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

