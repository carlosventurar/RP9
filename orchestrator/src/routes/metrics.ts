// RP9 Orchestrator - Prometheus Metrics Routes
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { register, collectDefaultMetrics, Gauge, Counter, Histogram } from 'prom-client'
import { dbService } from '@/services/database'
import { dockerService } from '@/services/docker'
import { logger } from '@/utils/logger'

// Configurar métricas por defecto
collectDefaultMetrics({ prefix: 'rp9_orchestrator_' })

// Métricas personalizadas del orchestrator
const tenantGauge = new Gauge({
  name: 'rp9_tenants_total',
  help: 'Total number of tenants by mode and status',
  labelNames: ['mode', 'status', 'plan']
})

const tenantResourcesGauge = new Gauge({
  name: 'rp9_tenant_resources',
  help: 'Resource allocation per tenant',
  labelNames: ['tenant_id', 'subdomain', 'resource_type']
})

const autoscaleEventsCounter = new Counter({
  name: 'rp9_autoscale_events_total',
  help: 'Total autoscale events by tenant and action',
  labelNames: ['tenant_id', 'action', 'trigger_type']
})

const enforcementEventsCounter = new Counter({
  name: 'rp9_enforcement_events_total',
  help: 'Total enforcement events by tenant and action',
  labelNames: ['tenant_id', 'action', 'limit_type', 'severity']
})

const backupsGauge = new Gauge({
  name: 'rp9_backups_total',
  help: 'Total backups by tenant and status',
  labelNames: ['tenant_id', 'status', 'backup_type']
})

const containerStatsGauge = new Gauge({
  name: 'rp9_container_stats',
  help: 'Docker container statistics',
  labelNames: ['stat_type']
})

// Métricas específicas por tenant (las requeridas en la spec)
const tenantQueueWaitGauge = new Gauge({
  name: 'rp9_tenant_queue_wait_p95_seconds',
  help: 'Queue wait time p95 by tenant',
  labelNames: ['tenant']
})

const tenantCpuGauge = new Gauge({
  name: 'rp9_tenant_cpu_percent',
  help: 'CPU usage percentage by tenant',
  labelNames: ['tenant']
})

const tenantMemoryGauge = new Gauge({
  name: 'rp9_tenant_mem_bytes',
  help: 'Memory usage in bytes by tenant',
  labelNames: ['tenant']
})

const tenantExecutionsGauge = new Gauge({
  name: 'rp9_tenant_executions_min',
  help: 'Executions per minute by tenant',
  labelNames: ['tenant']
})

const autoscaleEventsGauge = new Gauge({
  name: 'rp9_autoscale_events_total',
  help: 'Total autoscale events by tenant and action',
  labelNames: ['tenant', 'action']
})

export async function metricsRoutes(fastify: FastifyInstance) {

  // =============================================================================
  // GET /metrics - Prometheus metrics endpoint
  // =============================================================================
  
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Actualizar métricas antes de servir
      await updateMetrics()

      // Servir métricas en formato Prometheus
      reply.type('text/plain; version=0.0.4; charset=utf-8')
      return register.metrics()

    } catch (error) {
      logger.error({ error }, 'Failed to generate metrics')
      return reply.status(500).send('Internal Server Error')
    }
  })

  // =============================================================================
  // GET /metrics/tenant/:id - Métricas específicas por tenant
  // =============================================================================
  
  fastify.get('/tenant/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: tenantId } = request.params as { id: string }

    try {
      const tenant = await dbService.getTenantInstance(tenantId)
      if (!tenant) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Tenant not found',
          timestamp: new Date().toISOString()
        })
      }

      // Obtener métricas específicas del tenant
      const metrics = await getTenantSpecificMetrics(tenantId, tenant.subdomain)

      return {
        success: true,
        data: {
          tenant_id: tenantId,
          subdomain: tenant.subdomain,
          metrics,
          collected_at: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      logger.error({ error, tenant_id: tenantId }, 'Failed to get tenant metrics')
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to get tenant metrics',
        timestamp: new Date().toISOString()
      })
    }
  })
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function updateMetrics() {
  try {
    // 1. Actualizar métricas de tenants
    await updateTenantMetrics()

    // 2. Actualizar métricas de containers Docker
    await updateContainerMetrics()

    // 3. Actualizar métricas de eventos
    await updateEventMetrics()

    // 4. Actualizar métricas de backups
    await updateBackupMetrics()

  } catch (error) {
    logger.error({ error }, 'Failed to update metrics')
  }
}

async function updateTenantMetrics() {
  try {
    const tenants = await dbService.listTenantInstances()
    
    // Reset métricas de tenants
    tenantGauge.reset()
    tenantResourcesGauge.reset()

    // Contar tenants por modo, status y plan
    const counts: Record<string, number> = {}
    
    for (const tenant of tenants) {
      const key = `${tenant.mode}_${tenant.status}_${tenant.plan}`
      counts[key] = (counts[key] || 0) + 1

      // Actualizar gauge por categoría
      tenantGauge.labels(tenant.mode, tenant.status, tenant.plan).inc()

      // Métricas de recursos por tenant
      tenantResourcesGauge.labels(tenant.tenant_id, tenant.subdomain, 'cpu_cores').set(tenant.cpu_cores)
      tenantResourcesGauge.labels(tenant.tenant_id, tenant.subdomain, 'memory_mb').set(tenant.memory_mb)
      tenantResourcesGauge.labels(tenant.tenant_id, tenant.subdomain, 'workers').set(tenant.workers)
      tenantResourcesGauge.labels(tenant.tenant_id, tenant.subdomain, 'storage_gb').set(tenant.storage_gb)

      // Actualizar métricas específicas por tenant (mock data por ahora)
      if (tenant.mode === 'dedicated' && tenant.status === 'active') {
        await updateTenantSpecificMetrics(tenant.tenant_id, tenant.subdomain)
      }
    }

  } catch (error) {
    logger.error({ error }, 'Failed to update tenant metrics')
  }
}

async function updateContainerMetrics() {
  try {
    const dockerStats = await dockerService.getDockerStats()
    
    containerStatsGauge.labels('total').set(dockerStats.containers_total)
    containerStatsGauge.labels('running').set(dockerStats.containers_running)
    containerStatsGauge.labels('failed').set(dockerStats.containers_failed)
    containerStatsGauge.labels('images').set(dockerStats.images_total)

  } catch (error) {
    logger.error({ error }, 'Failed to update container metrics')
  }
}

async function updateEventMetrics() {
  // Esta función actualizaría contadores basados en eventos recientes
  // Por simplicidad, omitimos la implementación completa aquí
  try {
    // TODO: Implementar consultas a las tablas de eventos
    // y actualizar los contadores correspondientes
    
  } catch (error) {
    logger.error({ error }, 'Failed to update event metrics')
  }
}

async function updateBackupMetrics() {
  try {
    // TODO: Implementar métricas de backups por tenant
    
  } catch (error) {
    logger.error({ error }, 'Failed to update backup metrics')
  }
}

async function updateTenantSpecificMetrics(tenantId: string, subdomain: string) {
  try {
    // En una implementación real, estas métricas vendrían de:
    // 1. n8n API para queue metrics
    // 2. Docker stats para CPU/memory
    // 3. n8n database para executions
    
    // Por ahora, usamos datos mock realistas
    const mockMetrics = generateMockTenantMetrics()
    
    tenantQueueWaitGauge.labels(subdomain).set(mockMetrics.queue_wait_p95_seconds)
    tenantCpuGauge.labels(subdomain).set(mockMetrics.cpu_percent)
    tenantMemoryGauge.labels(subdomain).set(mockMetrics.memory_bytes)
    tenantExecutionsGauge.labels(subdomain).set(mockMetrics.executions_min)

  } catch (error) {
    logger.error({ error, tenant_id: tenantId }, 'Failed to update tenant specific metrics')
  }
}

async function getTenantSpecificMetrics(tenantId: string, subdomain: string) {
  // En una implementación real, obtendríamos estas métricas de fuentes reales
  const mockMetrics = generateMockTenantMetrics()
  
  return {
    queue_wait_p95_seconds: mockMetrics.queue_wait_p95_seconds,
    cpu_percent: mockMetrics.cpu_percent,
    memory_bytes: mockMetrics.memory_bytes,
    memory_mb: Math.round(mockMetrics.memory_bytes / 1024 / 1024),
    executions_per_minute: mockMetrics.executions_min,
    success_rate_percent: mockMetrics.success_rate_percent,
    active_workers: mockMetrics.active_workers,
    last_execution_at: mockMetrics.last_execution_at
  }
}

function generateMockTenantMetrics() {
  // Generar métricas mock realistas
  const baseTime = Date.now()
  
  return {
    queue_wait_p95_seconds: Math.random() * 5, // 0-5 seconds
    cpu_percent: Math.random() * 80 + 10, // 10-90%
    memory_bytes: Math.floor((Math.random() * 1024 + 512) * 1024 * 1024), // 512MB-1.5GB
    executions_min: Math.floor(Math.random() * 10 + 1), // 1-10 per minute
    success_rate_percent: Math.random() * 20 + 80, // 80-100%
    active_workers: Math.floor(Math.random() * 4 + 1), // 1-4 workers
    last_execution_at: new Date(baseTime - Math.random() * 300000).toISOString() // Last 5 minutes
  }
}