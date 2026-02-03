import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { resetPasswordSchema } from '@/lib/validations/auth';

/**
 * POST /api/v1/admin/auth/reset-password
 * Reset password using valid forgot-password token. Token is deleted after success (one-time use).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = resetPasswordSchema.parse(body);

    const userId = await authService.getForgotPasswordUserId(validatedData.token);
    if (userId == null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          },
        },
        { status: 400 }
      );
    }

    await userService.update(userId, { password: validatedData.password });
    await authService.deleteForgotPasswordToken(validatedData.token);

    return NextResponse.json(
      {
        success: true,
        data: { message: 'Password reset successfully.' },
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
    console.error('[ResetPassword] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
