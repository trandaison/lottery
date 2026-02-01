import { z } from 'zod';

/**
 * Draw validation schemas
 *
 * Follows Zod best practices for type-safe validation
 */

// Draw request schema
export const drawRequestSchema = z.object({
  prizeId: z.number().int().positive('Prize ID must be a positive integer'),
  draftMode: z.boolean().optional().default(false),
});

export type DrawRequestInput = z.infer<typeof drawRequestSchema>;
