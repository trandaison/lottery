import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { profileUpdateSchema, type ProfileUpdateInput } from '@/lib/validations/user';

async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  const user = await authService.verifyAuth(token);
  if (!user || user.role !== 'admin') return null;
  return user;
}

/**
 * GET /api/v1/admin/auth/me
 * Get current authenticated user
 * Verifies JWT and Redis session, updates TTL
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      const token = request.cookies.get('auth_token')?.value;
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: token ? 'SESSION_EXPIRED' : 'UNAUTHORIZED',
            message: token ? 'Session expired or invalid' : 'Not authenticated',
          },
        },
        { status: 401 }
      );
      if (token) response.cookies.delete('auth_token');
      return response;
    }

    const { passwordDigest, ...userWithoutPassword } = user;
    return NextResponse.json(
      { success: true, data: { user: userWithoutPassword } },
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

/**
 * PATCH /api/v1/admin/auth/me
 * Update current user profile (name, email, password, phone)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = profileUpdateSchema.parse(body) as ProfileUpdateInput & {
      confirmPassword?: string;
    };

    if (validated.email !== user.email) {
      const other = await userService.getByEmail(validated.email);
      if (other) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'EMAIL_EXISTS', message: 'Email already in use' },
          },
          { status: 400 }
        );
      }
    }

    const updated = await userService.update(user.id, {
      name: validated.name,
      email: validated.email,
      phone: validated.phone ?? undefined,
      ...(validated.password ? { password: validated.password } : {}),
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } },
        { status: 500 }
      );
    }

    const { passwordDigest, ...userPublic } = updated;
    return NextResponse.json({
      success: true,
      data: { user: userPublic },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
