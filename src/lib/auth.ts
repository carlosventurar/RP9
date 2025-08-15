import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  tenantId: string
  role: 'owner' | 'member'
}

export interface JWTPayload extends AuthUser {
  iat: number
  exp: number
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { 
    expiresIn: '7d',
    issuer: 'agente-virtual-ia'
  })
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return {
      id: decoded.id,
      email: decoded.email,
      tenantId: decoded.tenantId,
      role: decoded.role
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

export function getAuthUser(request: NextRequest): AuthUser | null {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return null
    
    return verifyToken(token)
  } catch (error) {
    console.error('Auth extraction failed:', error)
    return null
  }
}

export function createMockUser(): AuthUser {
  return {
    id: '1',
    email: 'admin@agentevirtualia.com',
    tenantId: 'demo-tenant',
    role: 'owner'
  }
}