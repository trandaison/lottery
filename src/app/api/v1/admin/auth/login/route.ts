import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/services/auth.service';

// Request validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginRequest = z.infer<typeof loginSchema>;

/**
 * POST /api/v1/admin/auth/login
 * Authenticate admin user and create session
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Authenticate user
    const result = await authService.login(
      validatedData.email,
      validatedData.password,
      validatedData.rememberMe
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (result.user.role !== 'admin') {
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

    // Create response with JWT in HttpOnly cookie
    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
          token: result.tokens.accessToken,
        },
      },
      { status: 200 }
    );

    // Set HttpOnly cookie with JWT
    // Cookie settings:
    // - httpOnly: prevents JavaScript access (XSS protection)
    // - secure: HTTPS only (in production)
    // - sameSite: CSRF protection
    // - path: available site-wide
    // - maxAge: matches session TTL
    const maxAge = validatedData.rememberMe
      ? 7 * 24 * 60 * 60 // 7 days
      : 2 * 60 * 60; // 2 hours

    response.cookies.set('auth_token', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return response;
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    // Handle specific auth errors
    if (error instanceof Error) {
      if (error.message === 'USER_INACTIVE') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'USER_INACTIVE',
              message: 'User account is inactive',
            },
          },
          { status: 403 }
        );
      }
    }

    // Handle unexpected errors
    console.error('Login error:', error);
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
