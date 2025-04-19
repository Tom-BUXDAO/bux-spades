import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }
    
    return NextResponse.json({ success: true, user: session.user });
  } catch (error) {
    console.error("Credentials callback error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
} 