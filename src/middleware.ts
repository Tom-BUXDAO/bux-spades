import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verify } from "jsonwebtoken";

// Add paths that should be protected
const protectedPaths = ["/game", "/profile", "/settings"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if the path should be protected
  const isProtectedPath = protectedPaths.some((protectedPath) =>
    path.startsWith(protectedPath)
  );

  if (isProtectedPath) {
    const token = request.cookies.get("auth-token");

    if (!token) {
      // Redirect to login if no token is present
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      // Verify the token
      verify(token.value, process.env.JWT_SECRET || "your-secret-key");
      return NextResponse.next();
    } catch (error) {
      // Token is invalid or expired
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // For non-protected paths, allow access
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - register (registration page)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|login|register).*)",
  ],
}; 