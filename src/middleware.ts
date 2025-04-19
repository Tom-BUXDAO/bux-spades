import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Add paths that should be protected
const protectedPaths = ["/game", "/profile", "/settings"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if the path should be protected
  const isProtectedPath = protectedPaths.some((protectedPath) =>
    path.startsWith(protectedPath)
  );

  if (isProtectedPath) {
    const token = await getToken({ req: request });

    if (!token) {
      // Redirect to login if no token is present
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
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