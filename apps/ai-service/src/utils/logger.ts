import pino from 'pino'
import { config } from './config'

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: config.NODE_ENV === 'development',
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{levelLabel} - {msg}',
      errorLikeObjectKeys: ['err', 'error']
    }
  },
  serializers: {
    req: (request) => ({
      method: request.method,
      url: request.url,
      headers: {
        'user-agent': request.headers['user-agent'],
        'content-type': request.headers['content-type']
      },
      remoteAddress: request.ip,
      remotePort: request.socket?.remotePort
    }),
    res: (reply) => ({
      statusCode: reply.statusCode,
      headers: {
        'content-type': reply.getHeader('content-type'),
        'content-length': reply.getHeader('content-length')
      }
    }),
    err: pino.stdSerializers.err
  }
})

// Helper functions for structured logging
export const logAIRequest = (data: {
  tenantId: string
  userId: string
  provider: string
  action: string
  tokens?: { input: number; output: number }
  cost?: number
  latency?: number
  cached?: boolean
}) => {
  logger.info({
    event: 'ai_request',
    ...data
  }, `AI Request: ${data.action} via ${data.provider}`)
}

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error({
    err: error,
    context
  }, `Error: ${error.message}`)
}

export const logCacheHit = (key: string, ttl: number) => {
  logger.debug({
    event: 'cache_hit',
    key,
    ttl
  }, `Cache hit: ${key}`)
}

export const logCacheMiss = (key: string) => {
  logger.debug({
    event: 'cache_miss',
    key
  }, `Cache miss: ${key}`)
}

export const logBudgetCheck = (data: {
  tenantId: string
  spent: number
  limit: number
  action: 'allowed' | 'blocked' | 'warned'
}) => {
  logger.info({
    event: 'budget_check',
    ...data
  }, `Budget check: ${data.action} for tenant ${data.tenantId}`)
}