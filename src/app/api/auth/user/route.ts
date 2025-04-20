import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    // First check NextAuth session
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          username: true,
          coins: true,
          image: true
        }
      });
      
      if (user) {
        return NextResponse.json({ user });
      }
    }

    // Then check custom auth token
    const token = cookies().get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
      // Verify the token
      const decoded = verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret') as any;
      
      // Get user data from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          username: true,
          coins: true,
          image: true
        }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Return user data
      return NextResponse.json({ user });
    } catch (error) {
      // Token is invalid
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  } catch (error) {
    console.error('User data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 