import { LRUCache } from 'lru-cache'
import crypto from 'crypto'
import { config } from '@/utils/config'
import { logger, logCacheHit, logCacheMiss } from '@/utils/logger'
import type { CacheEntry } from '@/types'

class AICache {
  private cache: LRUCache<string, CacheEntry>

  constructor() {
    this.cache = new LRUCache<string, CacheEntry>({
      max: config.AI_CACHE_MAX_SIZE,
      ttl: config.AI_CACHE_TTL_SEC * 1000, // Convert to milliseconds
      updateAgeOnGet: true,
      allowStale: false
    })

    logger.info(`Cache initialized with max size: ${config.AI_CACHE_MAX_SIZE}, TTL: ${config.AI_CACHE_TTL_SEC}s`)
  }

  /**
   * Generate cache key from tenant, prompt hash, and context
   */
  private generateKey(tenantId: string, prompt: string, context?: any): string {
    const content = JSON.stringify({
      prompt: prompt.trim(),
      context: context || {}
    })
    
    const hash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16) // Take first 16 chars for shorter key

    return `${tenantId}:${hash}`
  }

  /**
   * Get cached response
   */
  get(tenantId: string, prompt: string, context?: any): any | null {
    const key = this.generateKey(tenantId, prompt, context)
    const entry = this.cache.get(key)

    if (entry) {
      const now = Date.now()
      const age = now - entry.created
      
      if (age < entry.ttl) {
        logCacheHit(key, entry.ttl - age)
        return entry.value
      } else {
        // Entry is stale, remove it
        this.cache.delete(key)
      }
    }

    logCacheMiss(key)
    return null
  }

  /**
   * Set cached response
   */
  set(tenantId: string, prompt: string, response: any, context?: any, customTtl?: number): void {
    const key = this.generateKey(tenantId, prompt, context)
    const ttl = (customTtl || config.AI_CACHE_TTL_SEC) * 1000
    
    const entry: CacheEntry = {
      key,
      value: response,
      ttl,
      created: Date.now()
    }

    this.cache.set(key, entry)
    
    logger.debug({
      key,
      ttl: ttl / 1000,
      size: JSON.stringify(response).length
    }, 'Cache entry stored')
  }

  /**
   * Invalidate cache for a tenant
   */
  invalidateTenant(tenantId: string): number {
    let count = 0
    
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.cache.delete(key)
        count++
      }
    }

    logger.info({ tenantId, count }, 'Cache invalidated for tenant')
    return count
  }

  /**
   * Clear specific cache entry
   */
  invalidate(tenantId: string, prompt: string, context?: any): boolean {
    const key = this.generateKey(tenantId, prompt, context)
    const deleted = this.cache.delete(key)
    
    if (deleted) {
      logger.debug({ key }, 'Cache entry invalidated')
    }
    
    return deleted
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: number
  } {
    const size = this.cache.size
    const maxSize = this.cache.max
    
    // Calculate hit rate (simplified)
    const calculatedSize = this.cache.calculatedSize || 0
    const hitRate = calculatedSize > 0 ? (size / calculatedSize) : 0

    return {
      size,
      maxSize,
      hitRate: Math.round(hitRate * 100),
      entries: size
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    logger.info('Cache cleared')
  }

  /**
   * Get cache size in bytes (approximate)
   */
  getSizeBytes(): number {
    let totalSize = 0
    
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2 // Approximate string size in bytes
      totalSize += JSON.stringify(entry.value).length * 2
    }
    
    return totalSize
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0
    
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.created
      if (age >= entry.ttl) {
        this.cache.delete(key)
        removed++
      }
    }
    
    if (removed > 0) {
      logger.debug({ removed }, 'Cache cleanup completed')
    }
    
    return removed
  }
}

// Export singleton instance
export const aiCache = new AICache()

// Periodic cleanup every 5 minutes
setInterval(() => {
  aiCache.cleanup()
}, 5 * 60 * 1000)