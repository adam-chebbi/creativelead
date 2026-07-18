import { NextResponse } from "next/server";

const SESSION_COOKIE = "cl_session";

function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/api/auth/send-magic-link") ||
    pathname.startsWith("/api/auth/verify-magic-link") ||
    pathname.startsWith("/api") ||
    pathname === "/_next" ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  );
}

export default function middleware(req: { url: string; cookies: { get: (name: string) => { value: string } | undefined } }) {
  const { pathname } = new URL(req.url);
  const response = NextResponse.next();

  // Security headers (keep existing)
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.delete("X-Powered-By");

  if (isPublicRoute(pathname)) return response;

  const session = req.cookies.get(SESSION_COOKIE);
  if (!session || !session.value) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
