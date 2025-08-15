import { NextRequest, NextResponse } from 'next/server'
import { signToken, createMockUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // For MVP, we'll use mock authentication
    // In production, you would validate against a real user database
    if (email === 'admin@agentevirtualia.com' && password === 'demo123') {
      const user = createMockUser()
      const token = signToken(user)

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role
        }
      })

      // Set HTTP-only cookie for security
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/'
      })

      return response
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}