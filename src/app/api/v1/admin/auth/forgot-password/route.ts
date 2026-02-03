import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/services/auth.service';
import { emailService } from '@/services/email.service';
import { env } from '@/config/env';
import { forgotPasswordSchema } from '@/lib/validations/auth';

const SUCCESS_MESSAGE =
  'If an account exists with this email, you will receive a reset link.';

/**
 * POST /api/v1/admin/auth/forgot-password
 * Request password reset. Always returns same success message to avoid user enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = forgotPasswordSchema.parse(body);

    const token = await authService.createForgotPasswordToken(validatedData.email);

    if (token) {
      const baseUrl = env.APP_URL ?? request.nextUrl.origin;
      const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(token)}`;
      await emailService.sendPasswordResetEmail(validatedData.email, resetUrl);
    }

    return NextResponse.json(
      {
        success: true,
        data: { message: SUCCESS_MESSAGE },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }
    console.error('[ForgotPassword] Error:', error);
    return NextResponse.json(
      {
        success: true,
        data: { message: SUCCESS_MESSAGE },
      },
      { status: 200 }
    );
  }
}
