import crypto from 'crypto'

/**
 * HMAC Security utilities for webhook verification
 * Used to validate incoming webhooks from 3CX, Genesys, and other external services
 */

export interface HMACConfig {
  secret: string
  algorithm?: string
  encoding?: BufferEncoding
}

export interface WebhookValidationResult {
  isValid: boolean
  error?: string
  computedSignature?: string
}

/**
 * Generate HMAC signature for outgoing requests following RP9 Phase 9 spec
 * Format: sha256=hmac(secret, timestamp + "\n" + rawBody)
 */
export function generateHMACSignature(
  payload: string | Buffer, 
  config: HMACConfig,
  timestamp?: string
): string {
  const { secret, algorithm = 'sha256', encoding = 'hex' } = config
  
  if (!secret) {
    throw new Error('HMAC secret is required')
  }

  // Phase 9 spec: timestamp + "\n" + rawBody
  const ts = timestamp || Math.floor(Date.now() / 1000).toString()
  const signaturePayload = `${ts}\n${payload}`

  const hmac = crypto.createHmac(algorithm, secret)
  hmac.update(signaturePayload)
  return hmac.digest(encoding)
}

/**
 * Sign body following RP9 Phase 9 specification
 */
export function signBody(bodyRaw: string, timestamp: string, secret: string): string {
  const payload = `${timestamp}\n${bodyRaw}`
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `sha256=${mac}`
}

/**
 * Verify HMAC signature from incoming webhooks
 * Supports common webhook signature formats and Phase 9 specification
 */
export function verifyHMACSignature(
  payload: string | Buffer,
  receivedSignature: string,
  config: HMACConfig,
  timestamp?: string
): WebhookValidationResult {
  try {
    const { secret, algorithm = 'sha256' } = config

    if (!secret) {
      return { isValid: false, error: 'HMAC secret not configured' }
    }

    if (!receivedSignature) {
      return { isValid: false, error: 'No signature provided' }
    }

    // Generate expected signature
    const computedSignature = generateHMACSignature(payload, config, timestamp)
    
    // Clean up received signature (remove prefixes like 'sha256=')
    const cleanReceivedSignature = receivedSignature.replace(/^(sha256=|sha1=)/, '')
    
    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'hex'),
      Buffer.from(cleanReceivedSignature, 'hex')
    )

    return {
      isValid,
      computedSignature,
      error: isValid ? undefined : 'Signature verification failed'
    }

  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown HMAC verification error'
    }
  }
}

/**
 * Verify webhook signature following RP9 Phase 9 specification
 * Validates timestamp window (±5 minutes by default)
 */
export function verifySignature(
  bodyRaw: string, 
  timestamp: string, 
  signatureHeader: string | undefined, 
  secret: string, 
  skewSec: number = 300
): boolean {
  if (!signatureHeader) return false
  
  const now = Math.floor(Date.now() / 1000)
  const ts = parseInt(timestamp || '0', 10)
  
  // Validate timestamp window
  if (!ts || Math.abs(now - ts) > skewSec) return false
  
  const expected = signBody(bodyRaw, timestamp, secret)
  
  try {
    const a = Buffer.from(signatureHeader.replace(/^sha256=/, '').trim(), 'hex')
    const b = Buffer.from(expected.replace(/^sha256=/, '').trim(), 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Verify webhook with multiple signature header formats
 * Supports GitHub, Stripe, and generic webhook formats
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): WebhookValidationResult {
  // Try different common header names
  const signatureHeaders = [
    'x-rp9-signature',        // Our custom header
    'x-hub-signature-256',    // GitHub style
    'x-signature',            // Generic
    'signature'               // Fallback
  ]

  let receivedSignature: string | undefined

  // Find signature in headers
  for (const headerName of signatureHeaders) {
    const headerValue = headers[headerName] || headers[headerName.toLowerCase()]
    if (headerValue) {
      receivedSignature = Array.isArray(headerValue) ? headerValue[0] : headerValue
      break
    }
  }

  if (!receivedSignature) {
    return { isValid: false, error: 'No signature header found' }
  }

  return verifyHMACSignature(payload, receivedSignature, { secret })
}

/**
 * Create middleware for Express-like functions to verify HMAC
 */
export function createHMACMiddleware(secret: string) {
  return (payload: string | Buffer, headers: Record<string, any>) => {
    return verifyWebhookSignature(payload, headers, secret)
  }
}

/**
 * Safe comparison for strings to prevent timing attacks
 */
export function timingSafeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Generate secure random HMAC secret
 */
export function generateHMACSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hash sensitive data for logging (one-way hash for privacy)
 */
export function hashForLogging(data: string, salt?: string): string {
  const actualSalt = salt || 'rp9-logging-salt'
  return crypto.createHash('sha256').update(data + actualSalt).digest('hex').substring(0, 8)
}

/**
 * Validate that a signature follows expected format
 */
export function isValidSignatureFormat(signature: string): boolean {
  // Check for hex format (with or without prefixes)
  const hexPattern = /^(sha256=|sha1=)?[a-f0-9]+$/i
  return hexPattern.test(signature)
}

/**
 * Webhook security configuration for different providers
 */
export const WEBHOOK_CONFIGS = {
  '3CX': {
    signatureHeader: 'x-3cx-signature',
    algorithm: 'sha256' as const,
    encoding: 'hex' as const
  },
  'GENESYS': {
    signatureHeader: 'x-genesys-signature',
    algorithm: 'sha256' as const,
    encoding: 'hex' as const
  },
  'GENERIC': {
    signatureHeader: 'x-rp9-signature',
    algorithm: 'sha256' as const,
    encoding: 'hex' as const
  }
} as const

export type WebhookProvider = keyof typeof WEBHOOK_CONFIGS