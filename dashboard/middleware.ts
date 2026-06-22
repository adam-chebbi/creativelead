import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const ROLE_WEIGHT: Record<string, number> = {
  USER:        1,
  ADMIN:       2,
  SUPER_ADMIN: 3,
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Block suspended users entirely
    if (token?.suspended) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'AccountSuspended');
      return NextResponse.redirect(url);
    }

    // CSRF Protection for API routes
    if (
      pathname.startsWith('/api/') && 
      !pathname.startsWith('/api/auth/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ) {
      const origin = req.headers.get('origin');
      const isDesktopClient = req.headers.has('x-desktop-worker') || req.headers.get('user-agent')?.includes('Electron');
      
      if (!isDesktopClient) {
        const allowedOrigin = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        // If origin is present and doesn't match our app, block it
        if (origin && !origin.startsWith(allowedOrigin)) {
          return new NextResponse(
            JSON.stringify({ error: 'CSRF Validation Failed: Origin mismatch' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // If no origin is present and it's a browser request (has referer but no custom header), it could be a CSRF attempt, but usually modern browsers send Origin on POST.
      }
    }

    // Admin routes require ADMIN or higher
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      const role = token?.role as string | undefined;
      const weight = ROLE_WEIGHT[role ?? ''] ?? 0;
      if (weight < ROLE_WEIGHT.ADMIN) {
        // API route → 403 JSON
        if (pathname.startsWith('/api/')) {
          return new NextResponse(
            JSON.stringify({ error: 'Forbidden: insufficient role' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // Page route → redirect to 403 page
        const url = req.nextUrl.clone();
        url.pathname = '/403';
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/download/:path*',
    '/download',
    '/api/admin/:path*',
    '/api/desktop/:path*',
  ],
};
