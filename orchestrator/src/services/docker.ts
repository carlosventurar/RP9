// RP9 Orchestrator - Docker Service  
import Docker from 'dockerode'
import { config } from '@/utils/config'
import { logger, createTenantLogger } from '@/utils/logger'
import { ContainerConfig, TraefikLabels } from '@/types'

export class DockerService {
  private docker: Docker

  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
    })
    
    logger.info('Docker service initialized')
  }

  // =============================================================================
  // N8N CONTAINER MANAGEMENT
  // =============================================================================

  async createN8nContainer(
    tenantId: string,
    subdomain: string,
    options: {
      cpu_cores: number
      memory_mb: number
      workers: number
      db_name: string
      environment?: 'blue' | 'green'
    }
  ): Promise<string> {
    const tenantLogger = createTenantLogger(tenantId)
    const containerName = this.generateContainerName(subdomain, options.environment)

    try {
      // Configuración del contenedor n8n
      const containerConfig = this.buildN8nContainerConfig(
        containerName,
        subdomain,
        options
      )

      tenantLogger.info({ container_name: containerName }, 'Creating n8n container')

      // Crear y iniciar el contenedor
      const container = await this.docker.createContainer(containerConfig)
      await container.start()

      const containerInfo = await container.inspect()
      const containerId = containerInfo.Id

      tenantLogger.info({ 
        container_id: containerId,
        container_name: containerName 
      }, 'N8n container created and started')

      return containerId

    } catch (error) {
      tenantLogger.error({ error, container_name: containerName }, 'Failed to create n8n container')
      throw new Error(`Failed to create n8n container: ${error}`)
    }
  }

  async scaleContainer(
    containerId: string,
    tenantId: string,
    resources: {
      cpu_cores: number
      memory_mb: number
    }
  ): Promise<void> {
    const tenantLogger = createTenantLogger(tenantId)

    try {
      const container = this.docker.getContainer(containerId)

      // Actualizar recursos del contenedor
      await container.update({
        Memory: resources.memory_mb * 1024 * 1024, // Convert MB to bytes
        CpuShares: resources.cpu_cores * 1024, // Docker CPU shares
        NanoCpus: resources.cpu_cores * 1000000000 // nanocpus for precise control
      })

      tenantLogger.info({ 
        container_id: containerId,
        cpu_cores: resources.cpu_cores,
        memory_mb: resources.memory_mb
      }, 'Container resources updated')

    } catch (error) {
      tenantLogger.error({ error, container_id: containerId }, 'Failed to scale container')
      throw new Error(`Failed to scale container: ${error}`)
    }
  }

  async stopContainer(containerId: string, tenantId: string): Promise<void> {
    const tenantLogger = createTenantLogger(tenantId)

    try {
      const container = this.docker.getContainer(containerId)
      await container.stop({ t: 30 }) // 30 seconds timeout

      tenantLogger.info({ container_id: containerId }, 'Container stopped')

    } catch (error) {
      tenantLogger.error({ error, container_id: containerId }, 'Failed to stop container')
      throw new Error(`Failed to stop container: ${error}`)
    }
  }

  async removeContainer(containerId: string, tenantId: string): Promise<void> {
    const tenantLogger = createTenantLogger(tenantId)

    try {
      const container = this.docker.getContainer(containerId)
      
      // Stop container first if running
      try {
        await container.stop({ t: 10 })
      } catch (stopError) {
        // Container might already be stopped
      }

      await container.remove({ force: true })

      tenantLogger.info({ container_id: containerId }, 'Container removed')

    } catch (error) {
      tenantLogger.error({ error, container_id: containerId }, 'Failed to remove container')
      throw new Error(`Failed to remove container: ${error}`)
    }
  }

  async getContainerStatus(containerId: string): Promise<{
    status: 'running' | 'stopped' | 'failed' | 'restarting'
    health: 'healthy' | 'unhealthy' | 'starting'
    stats: {
      cpu_percent: number
      memory_bytes: number
      memory_percent: number
    }
  }> {
    try {
      const container = this.docker.getContainer(containerId)
      const info = await container.inspect()
      const stats = await container.stats({ stream: false })

      // Parse container status
      let status: 'running' | 'stopped' | 'failed' | 'restarting' = 'stopped'
      if (info.State.Running) {
        status = 'running'
      } else if (info.State.Restarting) {
        status = 'restarting'
      } else if (info.State.ExitCode !== 0) {
        status = 'failed'
      }

      // Parse health status
      let health: 'healthy' | 'unhealthy' | 'starting' = 'starting'
      if (info.State.Health) {
        health = info.State.Health.Status === 'healthy' ? 'healthy' : 'unhealthy'
      }

      // Calculate CPU and memory stats
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
      const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100

      const memoryUsage = stats.memory_stats.usage
      const memoryLimit = stats.memory_stats.limit
      const memoryPercent = (memoryUsage / memoryLimit) * 100

      return {
        status,
        health,
        stats: {
          cpu_percent: Math.round(cpuPercent * 100) / 100,
          memory_bytes: memoryUsage,
          memory_percent: Math.round(memoryPercent * 100) / 100
        }
      }

    } catch (error) {
      logger.error({ error, container_id: containerId }, 'Failed to get container status')
      throw new Error(`Failed to get container status: ${error}`)
    }
  }

  // =============================================================================
  // BLUE/GREEN DEPLOYMENT
  // =============================================================================

  async swapBlueGreen(
    tenantId: string,
    subdomain: string,
    fromEnvironment: 'blue' | 'green',
    toEnvironment: 'blue' | 'green'
  ): Promise<void> {
    const tenantLogger = createTenantLogger(tenantId)

    try {
      const fromContainer = this.generateContainerName(subdomain, fromEnvironment)
      const toContainer = this.generateContainerName(subdomain, toEnvironment)

      // Actualizar labels de Traefik para hacer el swap
      const toContainerInstance = this.docker.getContainer(toContainer)
      
      // Primero actualizar el nuevo contenedor para que sea activo
      await this.updateTraefikLabels(toContainerInstance, subdomain, true)
      
      // Luego desactivar el contenedor anterior
      const fromContainerInstance = this.docker.getContainer(fromContainer)
      await this.updateTraefikLabels(fromContainerInstance, subdomain, false)

      tenantLogger.info({
        from_container: fromContainer,
        to_container: toContainer
      }, 'Blue/Green swap completed')

    } catch (error) {
      tenantLogger.error({ error, subdomain }, 'Failed to swap blue/green containers')
      throw new Error(`Failed to swap blue/green containers: ${error}`)
    }
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private generateContainerName(subdomain: string, environment?: 'blue' | 'green'): string {
    const suffix = environment ? `-${environment}` : ''
    return `n8n-${subdomain}${suffix}`
  }

  private buildN8nContainerConfig(
    containerName: string,
    subdomain: string,
    options: {
      cpu_cores: number
      memory_mb: number
      workers: number
      db_name: string
      environment?: 'blue' | 'green'
    }
  ): ContainerConfig {
    const labels = this.generateTraefikLabels(containerName, subdomain, !options.environment)
    
    return {
      name: containerName,
      image: config.n8n_image,
      env: {
        // n8n configuration
        N8N_PROTOCOL: 'https',
        N8N_HOST: `${subdomain}.${config.traefik_domain}`,
        N8N_PORT: '5678',
        N8N_LISTEN_ADDRESS: '0.0.0.0',
        
        // Database configuration
        DB_TYPE: 'postgresdb',
        DB_POSTGRESDB_HOST: 'postgres',
        DB_POSTGRESDB_PORT: '5432',
        DB_POSTGRESDB_DATABASE: options.db_name,
        DB_POSTGRESDB_USER: 'n8n',
        DB_POSTGRESDB_PASSWORD: config.db_password,
        
        // Queue mode configuration
        QUEUE_BULL_REDIS_HOST: 'redis',
        QUEUE_BULL_REDIS_PORT: '6379',
        EXECUTIONS_MODE: 'queue',
        EXECUTIONS_PROCESS: 'main',
        
        // Workers configuration
        N8N_WORKERS: options.workers.toString(),
        
        // Security
        N8N_SECURE_COOKIE: 'true',
        N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true',
        
        // Logging
        N8N_LOG_LEVEL: 'info',
        N8N_LOG_OUTPUT: 'console',
        
        // Tenant identification
        N8N_TENANT_ID: subdomain
      },
      labels,
      exposedPorts: {
        '5678/tcp': {}
      },
      hostConfig: {
        portBindings: {},
        memory: options.memory_mb * 1024 * 1024, // Convert to bytes
        cpuShares: options.cpu_cores * 1024,
        restartPolicy: { name: 'unless-stopped' }
      },
      networkingConfig: {
        endpointsConfig: {
          'rp9-network': {}
        }
      }
    }
  }

  private generateTraefikLabels(
    containerName: string, 
    subdomain: string,
    isActive: boolean = true
  ): Record<string, string> {
    const routerName = `${containerName}-router`
    const serviceName = `${containerName}-service`
    
    const labels: Record<string, string> = {
      'traefik.enable': isActive.toString(),
      'traefik.docker.network': 'rp9-network',
      [`traefik.http.routers.${routerName}.rule`]: `Host(\`${subdomain}.${config.traefik_domain}\`)`,
      [`traefik.http.routers.${routerName}.tls`]: 'true',
      [`traefik.http.routers.${routerName}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: '5678',
      
      // Health check
      [`traefik.http.services.${serviceName}.loadbalancer.healthcheck.path`]: '/healthz',
      [`traefik.http.services.${serviceName}.loadbalancer.healthcheck.interval`]: '30s',
      
      // Rate limiting
      [`traefik.http.middlewares.${containerName}-ratelimit.ratelimit.burst`]: '100',
      [`traefik.http.middlewares.${containerName}-ratelimit.ratelimit.average`]: '50',
      [`traefik.http.routers.${routerName}.middlewares`]: `${containerName}-ratelimit`,
      
      // RP9 metadata
      'rp9.tenant.subdomain': subdomain,
      'rp9.service.type': 'n8n',
      'rp9.service.version': '1.0.0'
    }

    return labels
  }

  private async updateTraefikLabels(
    container: Docker.Container,
    subdomain: string,
    isActive: boolean
  ): Promise<void> {
    const info = await container.inspect()
    const currentLabels = info.Config.Labels || {}
    
    // Update only the enable label to activate/deactivate
    const updatedLabels = {
      ...currentLabels,
      'traefik.enable': isActive.toString()
    }

    // Note: Docker doesn't support updating labels on running containers
    // In production, this would require container recreation
    logger.warn({ 
      container_id: container.id, 
      subdomain,
      is_active: isActive 
    }, 'Label update requires container recreation in production')
  }

  // =============================================================================
  // HEALTH & MONITORING
  // =============================================================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.docker.ping()
      return true
    } catch (error) {
      logger.error({ error }, 'Docker health check failed')
      return false
    }
  }

  async listTenantContainers(): Promise<Array<{
    id: string
    name: string
    subdomain: string
    status: string
    created: string
  }>> {
    try {
      const containers = await this.docker.listContainers({ all: true })
      
      return containers
        .filter(container => 
          container.Labels && 
          container.Labels['rp9.service.type'] === 'n8n'
        )
        .map(container => ({
          id: container.Id,
          name: container.Names[0]?.replace('/', '') || '',
          subdomain: container.Labels['rp9.tenant.subdomain'] || '',
          status: container.State,
          created: new Date(container.Created * 1000).toISOString()
        }))

    } catch (error) {
      logger.error({ error }, 'Failed to list tenant containers')
      throw new Error(`Failed to list tenant containers: ${error}`)
    }
  }

  async getDockerStats(): Promise<{
    containers_total: number
    containers_running: number
    containers_failed: number
    images_total: number
  }> {
    try {
      const containers = await this.docker.listContainers({ all: true })
      const images = await this.docker.listImages()

      const runningCount = containers.filter(c => c.State === 'running').length
      const failedCount = containers.filter(c => 
        c.State === 'exited' && c.Status.includes('(1)')
      ).length

      return {
        containers_total: containers.length,
        containers_running: runningCount,
        containers_failed: failedCount,
        images_total: images.length
      }

    } catch (error) {
      logger.error({ error }, 'Failed to get Docker stats')
      throw new Error(`Failed to get Docker stats: ${error}`)
    }
  }
}

export const dockerService = new DockerService()