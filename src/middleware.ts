import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authService } from '@/services/auth.service';

/**
 * Middleware to protect admin routes
 * Verifies JWT and Redis session for /admin routes
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Allow login page and auth API routes
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/api/v1/admin/auth/')
  ) {
    return NextResponse.next();
  }

  // Get JWT from cookie
  const token = request.cookies.get('auth_token')?.value;

  // No token - redirect to login
  if (!token) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify JWT and check Redis session
    const user = await authService.verifyAuth(token);

    // Invalid session - redirect to login with error
    if (!user) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'session_expired');

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('auth_token');
      return response;
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('error', 'unauthorized');

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('auth_token');
      return response;
    }

    // User is authenticated and authorized - allow access
    // Add user info to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id.toString());
    requestHeaders.set('x-user-email', user.email);
    requestHeaders.set('x-user-role', user.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Middleware authentication error:', error);

    // On error, redirect to login
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('error', 'auth_error');

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');
    return response;
  }
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
