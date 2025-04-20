import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Get the token from cookies
    const token = cookies().get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    try {
      // Verify the token
      verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret');
      
      // Token is valid
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