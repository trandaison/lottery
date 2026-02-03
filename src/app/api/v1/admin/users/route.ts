import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/services/user.service';
import {
  createUserSchema,
  userFiltersSchema,
  type CreateUserInput,
  type UserFilters,
} from '@/lib/validations/user';
import type { ApiResponse } from '@/types';
import type { User } from '@/db/schema';

type UserPublic = Omit<User, 'passwordDigest'>;

/**
 * GET /api/v1/admin/users
 * List users with search and sort
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = userFiltersSchema.parse({
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }) as UserFilters;

    const result = await userService.list(filters);
    const usersPublic: UserPublic[] = result.users.map((u) => {
      const { passwordDigest, ...rest } = u;
      return rest;
    });

    return NextResponse.json({
      success: true,
      data: { users: usersPublic, total: result.total },
    });
  } catch (error) {
    console.error('Error listing users:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.message },
        },
        { status: 400 }
      );
    }
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list users' },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirmPassword: _, ...input } = createUserSchema.parse(body) as CreateUserInput & {
      confirmPassword?: string;
    };

    const existing = await userService.getByEmail(input.email);
    if (existing) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
        },
        { status: 400 }
      );
    }

    const user = await userService.create({
      name: input.name,
      email: input.email,
      password: input.password,
      phone: input.phone ?? undefined,
      role: input.role,
    });

    const { passwordDigest, ...userPublic } = user;
    return NextResponse.json(
      { success: true, data: userPublic },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' } },
      { status: 500 }
    );
  }
}
