import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths that require authentication
const protectedPaths = ["/game", "/profile", "/settings"];
// Paths that should redirect to game if already authenticated
const authPaths = ["/login", "/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request });
  
  // Check if the path requires authentication
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname === path);
  
  if (isProtectedPath && !token) {
    // Redirect to login if trying to access protected path without token
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (isAuthPath && token) {
    // Redirect to game if trying to access auth paths with valid token
    return NextResponse.redirect(new URL('/game', request.url));
  }
  
  // Not a protected path or has valid token, allow access
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}; 