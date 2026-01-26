import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

/**
 * POST /api/v1/admin/auth/logout
 * Logout user by deleting session from Redis
 */
export async function POST(request: NextRequest) {
  try {
    // Get JWT from cookie
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    // Verify JWT and extract token_base
    const decoded = authService.verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          },
        },
        { status: 401 }
      );
    }

    // Delete session from Redis
    await authService.logout(decoded.sub);

    // Create response and clear cookie
    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      },
      { status: 200 }
    );

    // Clear auth cookie
    response.cookies.delete('auth_token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
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
