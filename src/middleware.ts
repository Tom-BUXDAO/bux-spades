import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths that require authentication
const protectedPaths = ["/game", "/profile", "/settings"];
// Paths that should redirect to game if already authenticated
const authPaths = ["/login", "/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path requires authentication
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname === path);
  
  // First try NextAuth token
  const token = await getToken({ req: request });
  
  // Then try our custom auth token
  const authToken = request.cookies.get("auth-token")?.value;
  let customToken = null;
  
  if (authToken) {
    try {
      // For now, just check if the token exists
      // We'll verify the token in the API routes instead
      customToken = { exists: true };
    } catch (error) {
      console.error("Error checking custom token:", error);
    }
  }
  
  // User is authenticated if either token is valid
  const isAuthenticated = !!token || !!customToken;
  
  if (isProtectedPath && !isAuthenticated) {
    // Redirect to login if trying to access protected path without token
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (isAuthPath && isAuthenticated) {
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