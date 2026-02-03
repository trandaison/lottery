import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/services/user.service';
import { updateUserSchema, type UpdateUserInput } from '@/lib/validations/user';
import type { ApiResponse } from '@/types';
import type { User } from '@/db/schema';

type RouteParams = { params: Promise<{ id: string }> };
type UserPublic = Omit<User, 'passwordDigest'>;

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * GET /api/v1/admin/users/[id]
 * Get a single user
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userId = parseId(id);
    if (userId === null) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid user ID' } },
        { status: 400 }
      );
    }

    const user = await userService.getById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    const { passwordDigest, ...userPublic } = user;
    return NextResponse.json<ApiResponse<UserPublic>>({ success: true, data: userPublic });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/users/[id]
 * Update a user
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userId = parseId(id);
    if (userId === null) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid user ID' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateUserSchema.parse(body) as UpdateUserInput;

    const existing = await userService.getById(userId);
    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (validated.email !== undefined && validated.email !== existing.email) {
      const other = await userService.getByEmail(validated.email);
      if (other) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already in use' } },
          { status: 400 }
        );
      }
    }

    const updated = await userService.update(userId, {
      name: validated.name,
      email: validated.email,
      password: validated.password,
      phone: validated.phone,
      status: validated.status,
      role: validated.role,
    });

    if (!updated) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' } },
        { status: 500 }
      );
    }

    const { passwordDigest, ...userPublic } = updated;
    return NextResponse.json<ApiResponse<UserPublic>>({ success: true, data: userPublic });
  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' } },
      { status: 500 }
    );
  }
}
