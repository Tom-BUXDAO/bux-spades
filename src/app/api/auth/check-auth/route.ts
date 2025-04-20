import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    // First check NextAuth session
    const session = await getServerSession(authOptions);
    if (session) {
      return NextResponse.json({ authenticated: true });
    }

    // Then check custom auth token
    const token = cookies().get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    try {
      // Verify the token
      verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret');
      return NextResponse.json({ authenticated: true });
    } catch (error) {
      // Token is invalid
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 