import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json({ success: true });
    
    // Clear all possible auth tokens
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      expires: new Date(0)
    };
    
    // Clear our custom auth token
    response.cookies.set("auth-token", "", cookieOptions);
    
    // Clear NextAuth session token
    response.cookies.set("next-auth.session-token", "", cookieOptions);
    
    // Clear Discord OAuth tokens
    response.cookies.set("next-auth.callback-url", "", cookieOptions);
    response.cookies.set("next-auth.csrf-token", "", cookieOptions);
    
    // Clear any other potential auth cookies
    const cookieStore = cookies();
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith("next-auth.")) {
        response.cookies.set(cookie.name, "", cookieOptions);
      }
    }
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 