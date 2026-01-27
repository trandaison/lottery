import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

/**
 * Payment Service (Server-only)
 *
 * This file contains server-only functions for payment operations.
 * It should NEVER be imported in client components to avoid exposing env vars.
 */

/**
 * Generate JWT token for SePay webhook authentication
 * Uses campaign UUID as the subject claim
 * @param campaignUuid - Campaign UUID
 * @returns JWT token
 */
export function generateWebhookJWT(campaignUuid: string): string {
  const token = jwt.sign(
    {
      sub: campaignUuid,
    },
    env.SEPAY_WEBHOOK_JWT_SECRET,
    {
      // No expiration for webhook tokens as per requirements
      noTimestamp: false,
    },
  );

  return token;
}

/**
 * Verify JWT token from webhook request
 * Skips expiration check as per requirements
 * @param token - JWT token from Authorization header
 * @returns Decoded payload with campaign UUID, or null if invalid
 */
export function verifyWebhookJWT(
  token: string,
): { sub: string } | null {
  try {
    const decoded = jwt.verify(token, env.SEPAY_WEBHOOK_JWT_SECRET, {
      ignoreExpiration: true, // Skip expiration check
    }) as { sub: string };

    if (!decoded.sub) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}
