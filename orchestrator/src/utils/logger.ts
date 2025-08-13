// RP9 Orchestrator - Structured Logging with Pino
import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  })
})

// Helper para logs con contexto de tenant
export function createTenantLogger(tenantId: string) {
  return logger.child({ tenant_id: tenantId })
}

// Helper para logs con correlation ID
export function createCorrelationLogger(correlationId: string) {
  return logger.child({ correlation_id: correlationId })
}

// Helper para logs de audit trail
export function auditLog(operation: string, tenantId: string, details: any = {}) {
  logger.info({
    audit: true,
    operation,
    tenant_id: tenantId,
    details,
    timestamp: new Date().toISOString()
  }, `AUDIT: ${operation} for tenant ${tenantId}`)
}