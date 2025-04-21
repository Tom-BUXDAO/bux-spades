import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";

// Paths that require authentication
const protectedPaths = ["/game", "/profile", "/settings"];
// Paths that should redirect to game if already authenticated
const authPaths = ["/login", "/"];
// Auth-related paths that should be excluded from middleware checks
const excludedPaths = [
  "/api/auth",
  "/_next",
  "/static",
  "/images",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for excluded paths
  if (excludedPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if the path requires authentication
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname === path);
  
  // First try NextAuth token
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  // Then try our custom auth token
  const authToken = request.cookies.get("auth-token")?.value;
  let customToken = null;
  
  if (authToken) {
    try {
      const secret = new TextEncoder().encode(
        process.env.NEXTAUTH_SECRET || "fallback-secret"
      );
      
      const { payload } = await jwtVerify(authToken, secret);
      customToken = payload;
    } catch (error) {
      console.error("Error verifying custom token:", error);
    }
  }
  
  // User is authenticated if either token is valid
  const isAuthenticated = !!token || !!customToken;
  
  if (isProtectedPath && !isAuthenticated) {
    // Store the original URL to redirect back after login
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(url);
  }
  
  if (isAuthPath && isAuthenticated) {
    // Redirect to game if trying to access auth paths with valid token
    return NextResponse.redirect(new URL('/game', request.url));
  }
  
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ]
}; 