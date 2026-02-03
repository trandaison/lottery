import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

/**
 * GET /api/v1/admin/auth/reset-password/verify?token=...
 * Verify forgot-password token. Used by reset page to show form or invalid message.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token?.trim()) {
      return NextResponse.json(
        { success: false, data: { valid: false } },
        { status: 400 }
      );
    }

    const userId = await authService.getForgotPasswordUserId(token);
    if (userId == null) {
      return NextResponse.json(
        { success: true, data: { valid: false } },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, data: { valid: true, userId } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ResetPasswordVerify] Error:', error);
    return NextResponse.json(
      { success: true, data: { valid: false } },
      { status: 200 }
    );
  }
}
