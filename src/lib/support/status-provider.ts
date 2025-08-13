/**
 * Status Provider Adapter
 * Abstracción para diferentes proveedores de status page (Statuspage.io, BetterStack, etc.)
 */

export interface IncidentData {
  title: string
  description?: string
  impact: 'minor' | 'major' | 'critical'
  status?: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  components?: string[]
  scheduled?: boolean
  scheduledFor?: Date
  scheduledUntil?: Date
}

export interface IncidentUpdate {
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  message: string
  affectsComponents?: boolean
}

export interface ExternalIncident {
  id: string
  url: string
  shortlink?: string
}

export interface StatusComponent {
  id: string
  name: string
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage'
}

export abstract class StatusProvider {
  protected apiToken: string
  protected baseUrl: string

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  abstract createIncident(data: IncidentData): Promise<ExternalIncident>
  abstract updateIncident(incidentId: string, update: IncidentUpdate): Promise<boolean>
  abstract resolveIncident(incidentId: string, message: string): Promise<boolean>
  abstract getComponents(): Promise<StatusComponent[]>
  abstract updateComponentStatus(componentId: string, status: string): Promise<boolean>
}

/**
 * Statuspage.io Provider
 */
export class StatuspageProvider extends StatusProvider {
  private pageId: string

  constructor(apiToken: string, pageId: string) {
    super(apiToken)
    this.pageId = pageId
    this.baseUrl = 'https://api.statuspage.io/v1'
  }

  async createIncident(data: IncidentData): Promise<ExternalIncident> {
    const response = await fetch(`${this.baseUrl}/pages/${this.pageId}/incidents`, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        incident: {
          name: data.title,
          body: data.description || '',
          status: data.status || 'investigating',
          impact_override: data.impact,
          component_ids: data.components || [],
          scheduled_for: data.scheduledFor?.toISOString(),
          scheduled_until: data.scheduledUntil?.toISOString()
        }
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Statuspage API error (${response.status}): ${errorBody}`)
    }

    const result = await response.json()
    return {
      id: result.id,
      url: result.page_url,
      shortlink: result.shortlink
    }
  }

  async updateIncident(incidentId: string, update: IncidentUpdate): Promise<boolean> {
    // Crear update de incidente
    const response = await fetch(`${this.baseUrl}/pages/${this.pageId}/incidents/${incidentId}/incident_updates`, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        incident_update: {
          body: update.message,
          status: update.status,
          wants_twitter_update: false
        }
      })
    })

    return response.ok
  }

  async resolveIncident(incidentId: string, message: string): Promise<boolean> {
    return this.updateIncident(incidentId, {
      status: 'resolved',
      message
    })
  }

  async getComponents(): Promise<StatusComponent[]> {
    const response = await fetch(`${this.baseUrl}/pages/${this.pageId}/components`, {
      headers: {
        'Authorization': `OAuth ${this.apiToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Statuspage API error: ${response.status}`)
    }

    const data = await response.json()
    return data.map((component: any) => ({
      id: component.id,
      name: component.name,
      status: component.status
    }))
  }

  async updateComponentStatus(componentId: string, status: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/pages/${this.pageId}/components/${componentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `OAuth ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        component: {
          status
        }
      })
    })

    return response.ok
  }
}

/**
 * BetterStack Provider (formerly UptimeRobot)
 */
export class BetterStackProvider extends StatusProvider {
  constructor(apiToken: string) {
    super(apiToken)
    this.baseUrl = 'https://betterstack.com/api/v2'
  }

  async createIncident(data: IncidentData): Promise<ExternalIncident> {
    const response = await fetch(`${this.baseUrl}/incidents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: data.title,
        summary: data.description || '',
        status: data.status || 'investigating',
        impact: data.impact,
        affects_monitoring: data.components?.length ? true : false,
        monitor_ids: data.components || []
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`BetterStack API error (${response.status}): ${errorBody}`)
    }

    const result = await response.json()
    return {
      id: result.data.id,
      url: result.data.attributes.url || `https://status.betterstack.com/incidents/${result.data.id}`
    }
  }

  async updateIncident(incidentId: string, update: IncidentUpdate): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: update.status,
        summary: update.message
      })
    })

    return response.ok
  }

  async resolveIncident(incidentId: string, message: string): Promise<boolean> {
    return this.updateIncident(incidentId, {
      status: 'resolved',
      message
    })
  }

  async getComponents(): Promise<StatusComponent[]> {
    const response = await fetch(`${this.baseUrl}/monitors`, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`BetterStack API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data.map((monitor: any) => ({
      id: monitor.id,
      name: monitor.attributes.name,
      status: monitor.attributes.status === 'up' ? 'operational' : 'major_outage'
    }))
  }

  async updateComponentStatus(componentId: string, status: string): Promise<boolean> {
    // BetterStack maneja esto automáticamente basado en monitoreo
    // No hay API directa para cambiar estado manualmente
    console.warn('BetterStack component status updates are automatic based on monitoring')
    return true
  }
}

/**
 * Mock Provider para desarrollo/testing
 */
export class MockStatusProvider extends StatusProvider {
  private incidents: Map<string, any> = new Map()
  private components: StatusComponent[] = [
    { id: 'api', name: 'API Principal', status: 'operational' },
    { id: 'dashboard', name: 'Dashboard Web', status: 'operational' },
    { id: 'n8n', name: 'Motor de Workflows', status: 'operational' },
    { id: 'webhooks', name: 'Webhooks', status: 'operational' }
  ]

  constructor() {
    super('mock-token')
  }

  async createIncident(data: IncidentData): Promise<ExternalIncident> {
    const id = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const incident = {
      id,
      ...data,
      created_at: new Date(),
      status: data.status || 'investigating'
    }
    
    this.incidents.set(id, incident)
    
    console.log('Mock incident created:', incident)
    
    return {
      id,
      url: `https://status.example.com/incidents/${id}`,
      shortlink: `https://stspg.io/${id.substr(-6)}`
    }
  }

  async updateIncident(incidentId: string, update: IncidentUpdate): Promise<boolean> {
    const incident = this.incidents.get(incidentId)
    if (!incident) {
      return false
    }

    incident.status = update.status
    incident.last_update = update.message
    incident.updated_at = new Date()
    
    console.log('Mock incident updated:', { incidentId, update })
    
    return true
  }

  async resolveIncident(incidentId: string, message: string): Promise<boolean> {
    return this.updateIncident(incidentId, {
      status: 'resolved',
      message
    })
  }

  async getComponents(): Promise<StatusComponent[]> {
    return [...this.components]
  }

  async updateComponentStatus(componentId: string, status: string): Promise<boolean> {
    const component = this.components.find(c => c.id === componentId)
    if (component) {
      component.status = status as any
      console.log('Mock component status updated:', { componentId, status })
      return true
    }
    return false
  }
}

/**
 * Factory para crear provider según configuración
 */
export function createStatusProvider(
  provider: string,
  apiToken?: string,
  options?: { pageId?: string }
): StatusProvider {
  switch (provider.toLowerCase()) {
    case 'statuspage':
      if (!apiToken || !options?.pageId) {
        throw new Error('Statuspage requires API token and page ID')
      }
      return new StatuspageProvider(apiToken, options.pageId)
      
    case 'betterstack':
      if (!apiToken) {
        throw new Error('BetterStack requires API token')
      }
      return new BetterStackProvider(apiToken)
      
    case 'mock':
    default:
      return new MockStatusProvider()
  }
}

/**
 * Helper para mapear severidad RP9 a impacto de status provider
 */
export function mapSeverityToImpact(severity: string): 'minor' | 'major' | 'critical' {
  const impactMap = {
    'P1': 'critical' as const,
    'P2': 'major' as const,
    'P3': 'minor' as const
  }
  return impactMap[severity as keyof typeof impactMap] || 'minor'
}

/**
 * Helper para formatear mensaje de incidente
 */
export function formatIncidentMessage(incident: {
  title: string
  severity: string
  affected_services?: string[]
  eta?: string
}): string {
  let message = `Incidente ${incident.severity}: ${incident.title}`
  
  if (incident.affected_services?.length) {
    message += `\\n\\nServicios afectados: ${incident.affected_services.join(', ')}`
  }
  
  if (incident.eta) {
    message += `\\n\\nTiempo estimado de resolución: ${new Date(incident.eta).toLocaleString('es-MX')}`
  }
  
  message += '\\n\\nSeguiremos actualizando el estado conforme tengamos más información.'
  
  return message
}