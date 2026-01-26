import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';

/**
 * GET /api/v1/admin/auth/me
 * Get current authenticated user
 * Verifies JWT and Redis session, updates TTL
 */
export async function GET(request: NextRequest) {
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

    // Verify JWT and check Redis session
    // This also updates the session TTL
    const user = await authService.verifyAuth(token);

    if (!user) {
      // Session expired or invalid
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session expired or invalid',
          },
        },
        { status: 401 }
      );

      // Clear invalid cookie
      response.cookies.delete('auth_token');

      return response;
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Return user data (without password)
    const { passwordDigest, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        success: true,
        data: {
          user: userWithoutPassword,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get current user error:', error);
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
