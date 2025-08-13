// RP9 Orchestrator - Authentication & Authorization Utils
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { FastifyRequest, FastifyReply } from 'fastify'
import { JwtPayload, HmacRequest } from '@/types'
import { config } from './config'
import { logger } from './logger'

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

// Verificar JWT Token
export function verifyJwtToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, config.jwt_secret) as JwtPayload
    return payload
  } catch (error) {
    throw new AuthError('Invalid JWT token', 401)
  }
}

// Verificar HMAC Signature
export function verifyHmacSignature(
  timestamp: string,
  body: string,
  signature: string
): boolean {
  try {
    // Verificar timestamp (anti-replay attack)
    const requestTime = parseInt(timestamp, 10)
    const currentTime = Math.floor(Date.now() / 1000)
    const timeDiff = Math.abs(currentTime - requestTime)
    
    if (timeDiff > 300) { // 5 minutos de tolerancia
      throw new AuthError('Request timestamp too old', 401)
    }

    // Generar signature esperada
    const payload = `${timestamp}\n${body}`
    const expectedSignature = crypto
      .createHmac('sha256', config.hmac_secret)
      .update(payload)
      .digest('hex')

    // Comparación segura
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch (error) {
    return false
  }
}

// Middleware de autenticación JWT
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid Authorization header', 401)
    }

    const token = authHeader.substring(7)
    const payload = verifyJwtToken(token)
    
    // Agregar payload al request
    request.user = payload
    
  } catch (error) {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        error: 'Authentication failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    }
    
    logger.error({ error }, 'JWT authentication error')
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Authentication error',
      timestamp: new Date().toISOString()
    })
  }
}

// Middleware de verificación HMAC
export async function verifyHMAC(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const timestamp = request.headers['x-timestamp'] as string
    const signature = request.headers['x-rp9-signature'] as string
    
    if (!timestamp || !signature) {
      throw new AuthError('Missing HMAC headers', 401)
    }

    const body = JSON.stringify(request.body)
    const isValid = verifyHmacSignature(timestamp, body, signature)
    
    if (!isValid) {
      throw new AuthError('Invalid HMAC signature', 401)
    }
    
  } catch (error) {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        error: 'HMAC verification failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    }
    
    logger.error({ error }, 'HMAC verification error')
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'HMAC verification error',
      timestamp: new Date().toISOString()
    })
  }
}

// Middleware de autorización por rol
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as JwtPayload
      
      if (!user || !allowedRoles.includes(user.role)) {
        throw new AuthError('Insufficient permissions', 403)
      }
      
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({
          error: 'Authorization failed',
          message: error.message,
          timestamp: new Date().toISOString()
        })
      }
      
      logger.error({ error }, 'Authorization error')
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Authorization error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

// Helper para generar correlation ID
export function generateCorrelationId(): string {
  return crypto.randomBytes(16).toString('hex')
}

// Middleware para agregar correlation ID
export async function addCorrelationId(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const correlationId = (request.headers['x-correlation-id'] as string) || 
                       generateCorrelationId()
  
  request.correlationId = correlationId
  reply.header('x-correlation-id', correlationId)
}

// Extender tipos de FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload
    correlationId?: string
  }
}