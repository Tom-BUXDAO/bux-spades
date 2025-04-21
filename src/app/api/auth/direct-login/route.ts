import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    // Get the session
    const session = await getServerSession(authOptions);
    
    // Return user data
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || "",
        coins: user.coins,
        image: user.image
      }
    });
  } catch (error) {
    console.error("Direct login error:", error);
    return NextResponse.json(
      { error: "Server error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 