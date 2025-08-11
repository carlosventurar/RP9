/**
 * Simple in-memory rate limiting for Netlify Functions
 * For production, consider Redis-based rate limiting for better persistence
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitConfig {
  windowMs: number    // Time window in milliseconds
  maxRequests: number // Max requests per window
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  totalHits: number
}

// In-memory store (resets on function cold start)
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Clean expired entries from memory store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }
  
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key)
    }
  }
  
  lastCleanup = now
}

/**
 * Generate rate limit key from identifier and optional suffix
 */
function generateKey(identifier: string, suffix?: string): string {
  const base = `rl:${identifier}`
  return suffix ? `${base}:${suffix}` : base
}

/**
 * Apply rate limiting to a request
 */
export function rateLimit(
  identifier: string, 
  config: RateLimitConfig,
  suffix?: string
): RateLimitResult {
  cleanupExpiredEntries()
  
  const { windowMs, maxRequests } = config
  const key = generateKey(identifier, suffix)
  const now = Date.now()
  const resetTime = now + windowMs
  
  let entry = store.get(key)
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired one
    entry = {
      count: 1,
      resetTime
    }
  } else {
    // Increment existing entry
    entry.count++
  }
  
  store.set(key, entry)
  
  const allowed = entry.count <= maxRequests
  const remaining = Math.max(0, maxRequests - entry.count)
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
    totalHits: entry.count
  }
}

/**
 * Rate limit by IP address
 */
export function rateLimitByIP(
  ipAddress: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }
): RateLimitResult {
  return rateLimit(ipAddress, config, 'ip')
}

/**
 * Rate limit by tenant ID
 */
export function rateLimitByTenant(
  tenantId: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 300 }
): RateLimitResult {
  return rateLimit(tenantId, config, 'tenant')
}

/**
 * Rate limit by user ID
 */
export function rateLimitByUser(
  userId: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 200 }
): RateLimitResult {
  return rateLimit(userId, config, 'user')
}

/**
 * Rate limit by API endpoint
 */
export function rateLimitByEndpoint(
  endpoint: string,
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 50 }
): RateLimitResult {
  return rateLimit(identifier, config, `endpoint:${endpoint}`)
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(identifier: string, suffix?: string): RateLimitResult | null {
  const key = generateKey(identifier, suffix)
  const entry = store.get(key)
  
  if (!entry || Date.now() > entry.resetTime) {
    return null
  }
  
  return {
    allowed: true, // Not incrementing, so we don't know if next request would be allowed
    remaining: 0,   // Unknown without config
    resetTime: entry.resetTime,
    totalHits: entry.count
  }
}

/**
 * Reset rate limit for identifier
 */
export function resetRateLimit(identifier: string, suffix?: string): void {
  const key = generateKey(identifier, suffix)
  store.delete(key)
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.totalHits.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    'X-RateLimit-Reset-Time': new Date(result.resetTime).toISOString()
  }
}

/**
 * Middleware factory for Netlify Functions
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return (identifier: string) => {
    const result = rateLimit(identifier, config)
    
    if (!result.allowed) {
      const error = new Error('Rate limit exceeded')
      ;(error as any).statusCode = 429
      ;(error as any).headers = getRateLimitHeaders(result)
      throw error
    }
    
    return result
  }
}

/**
 * Extract client IP from Netlify Function event headers
 */
export function getClientIP(headers: Record<string, string | string[] | undefined>): string {
  // Try different headers that might contain the real IP
  const possibleHeaders = [
    'x-forwarded-for',
    'cf-connecting-ip',
    'x-real-ip',
    'x-client-ip'
  ]
  
  for (const header of possibleHeaders) {
    const value = headers[header] || headers[header.toLowerCase()]
    if (value) {
      const ip = Array.isArray(value) ? value[0] : value
      // Return first IP if comma-separated
      return ip.split(',')[0].trim()
    }
  }
  
  return 'unknown'
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
  // Very restrictive for sensitive endpoints
  STRICT: { windowMs: 60000, maxRequests: 10 },
  
  // Normal API usage
  NORMAL: { windowMs: 60000, maxRequests: 100 },
  
  // Generous for regular operations  
  GENEROUS: { windowMs: 60000, maxRequests: 300 },
  
  // Webhook endpoints (higher volume expected)
  WEBHOOK: { windowMs: 60000, maxRequests: 500 },
  
  // Public endpoints
  PUBLIC: { windowMs: 60000, maxRequests: 50 }
} as const

/**
 * Get current memory store statistics (for monitoring)
 */
export function getRateLimitStats(): { totalEntries: number, oldestEntry: number, newestEntry: number } {
  cleanupExpiredEntries()
  
  if (store.size === 0) {
    return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 }
  }
  
  const resetTimes = Array.from(store.values()).map(entry => entry.resetTime)
  
  return {
    totalEntries: store.size,
    oldestEntry: Math.min(...resetTimes),
    newestEntry: Math.max(...resetTimes)
  }
}