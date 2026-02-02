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
  /** When provided, use this as winning number (client-stopped number); otherwise server picks. */
  winningNumber: z.string().min(1).max(6).regex(/^\d+$/).optional(),
});

export type DrawRequestInput = z.infer<typeof drawRequestSchema>;
