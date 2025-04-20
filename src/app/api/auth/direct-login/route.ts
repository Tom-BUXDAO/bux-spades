import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing credentials", message: "Email and password are required" },
        { status: 400 }
      );
    }
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication failed", message: "Invalid credentials" },
        { status: 401 }
      );
    }
    
    if (!user.hashedPassword) {
      return NextResponse.json(
        { error: "Authentication failed", message: "User has no password" },
        { status: 401 }
      );
    }
    
    // Verify password
    const isCorrectPassword = await compare(password, user.hashedPassword);
    
    if (!isCorrectPassword) {
      return NextResponse.json(
        { error: "Authentication failed", message: "Invalid credentials" },
        { status: 401 }
      );
    }
    
    // Create a JWT token using jose
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || "fallback-secret"
    );
    
    const token = await new SignJWT({ 
      id: user.id,
      email: user.email,
      username: user.username,
      coins: user.coins
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(secret);
    
    // Set the token as a cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || "",
        coins: user.coins,
        image: user.image
      }
    });
    
    // Set the token as an HTTP-only cookie
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });
    
    return response;
  } catch (error) {
    console.error("Direct login error:", error);
    return NextResponse.json(
      { error: "Server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 