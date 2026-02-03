import { z } from 'zod';

const phoneOptional = z
  .string()
  .max(20)
  .optional()
  .nullable()
  .transform((v) => (v === '' ? null : v));

export const createUserSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(6, 'Password must be at least 6 characters').max(255),
    confirmPassword: z.string().optional(),
    phone: phoneOptional,
    role: z.enum(['admin', 'user']).default('user'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(6).max(255).optional(),
  phone: phoneOptional,
  status: z.enum(['active', 'inactive']).optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(6).max(255).optional().or(z.literal('')),
    confirmPassword: z.string().optional().or(z.literal('')),
    phone: phoneOptional,
  })
  .refine(
    (data) => {
      const p = (data.password ?? '').trim();
      const c = (data.confirmPassword ?? '').trim();
      if (p === '') return true; // no password change
      // Client may not send confirmPassword in body; if only password is set, accept (client already validated)
      if (c === '') return true;
      return p === c;
    },
    { message: 'Passwords do not match', path: ['confirmPassword'] },
  );

export const userFiltersSchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'email', 'phone', 'role', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.number().int().positive().max(500).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type UserFilters = z.infer<typeof userFiltersSchema>;
