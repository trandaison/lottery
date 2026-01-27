import { z } from 'zod';

/**
 * Campaign validation schemas
 *
 * Follows Zod best practices for type-safe validation
 */

// Prize schema (used in campaign creation/update)
export const prizeSchema = z.object({
  title: z.string().min(1, 'Prize title is required').max(255),
  prizesCount: z.number().int().positive('Prize count must be positive'),
  matchingDigits: z.number().int().min(1).max(6, 'Matching digits must be between 1 and 6'),
  prizeValue: z.number().int().positive('Prize value must be positive'),
});

// Create campaign schema
export const createCampaignSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(255),
    slug: z.string().max(255).optional(),
    description: z.string().optional(),
    startTime: z.string().datetime('Invalid start time format'),
    endTime: z.string().datetime('Invalid end time format'),
    ticketPrice: z.number().int().positive('Ticket price must be positive'),
    paymentType: z.enum(['direct', 'transfer']),
    bankNameOrCode: z.string().max(100).optional().nullable(),
    accountNumber: z.string().max(50).optional().nullable(),
    status: z.enum(['active', 'drawing', 'completed', 'canceled']).optional().default('active'),
    excludeWinningNumbers: z.boolean().optional().default(true),
    prizes: z.array(prizeSchema).min(1, 'At least one prize is required'),
  })
  .refine(
    (data) => {
      // Validate payment fields based on payment type
      if (data.paymentType === 'transfer') {
        return data.bankNameOrCode && data.accountNumber;
      }
      return true;
    },
    {
      message:
        'Bank information (bankNameOrCode, accountNumber) is required for transfer payment type',
      path: ['paymentType'],
    }
  )
  .refine(
    (data) => {
      // Validate date range
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end > start;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  );

// Update campaign schema (all fields optional except id)
export const updateCampaignSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    slug: z.string().max(255).optional(),
    description: z.string().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    ticketPrice: z.number().int().positive().optional(),
    paymentType: z.enum(['direct', 'transfer']).optional(),
    bankNameOrCode: z.string().max(100).optional().nullable(),
    accountNumber: z.string().max(50).optional().nullable(),
    status: z.enum(['active', 'drawing', 'completed', 'canceled']).optional(),
    excludeWinningNumbers: z.boolean().optional(),
    prizes: z.array(prizeSchema).optional(),
  })
  .refine(
    (data) => {
      // Validate date range if both are provided
      if (data.startTime && data.endTime) {
        const start = new Date(data.startTime);
        const end = new Date(data.endTime);
        return end > start;
      }
      return true;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  );

// Query filters schema
export const campaignFiltersSchema = z.object({
  status: z.enum(['active', 'drawing', 'completed', 'canceled']).optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

// Cancel/Complete action schema
export const campaignActionSchema = z.object({
  action: z.enum(['cancel', 'complete']),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CampaignFiltersInput = z.infer<typeof campaignFiltersSchema>;
export type CampaignActionInput = z.infer<typeof campaignActionSchema>;
