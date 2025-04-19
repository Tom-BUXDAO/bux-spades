import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    // Get the session from the request
    const session = await getServerSession(authOptions);
    
    if (!session) {
      // If no session, return a 401 error with a proper JSON response
      return NextResponse.json(
        { error: "Authentication failed", message: "Invalid credentials" }, 
        { status: 401 }
      );
    }
    
    // Get the host from headers
    const headersList = headers();
    const host = headersList.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    
    // If we have a session, return success with the user data
    return NextResponse.json({ 
      success: true, 
      user: session.user,
      url: `${baseUrl}/game` // Provide a full redirect URL
    });
  } catch (error) {
    console.error("Credentials callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed", message: "Server error" }, 
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return NextResponse.json(
    { error: "Method not allowed", message: "GET method is not supported" }, 
    { status: 405 }
  );
} 