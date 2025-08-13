import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Validación para crear/actualizar incidente
const incidentSchema = z.object({
  action: z.enum(['create', 'update', 'resolve']),
  
  // Para create
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  severity: z.enum(['P1', 'P2', 'P3']).optional(),
  impact: z.string().optional(),
  affected_services: z.array(z.string()).optional(),
  tenant_id: z.string().uuid().optional(),
  eta: z.string().datetime().optional(),
  
  // Para update/resolve
  incident_id: z.string().uuid().optional(),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']).optional(),
  update_message: z.string().optional(),
  by_user: z.string().optional()
}).refine(data => {
  if (data.action === 'create') {
    return data.title && data.severity
  }
  if (data.action === 'update' || data.action === 'resolve') {
    return data.incident_id
  }
  return true
}, {
  message: "Datos requeridos faltantes para la acción especificada"
})

// Cliente para providers de status (Statuspage/BetterStack)
class StatusProvider {
  private provider: string
  private apiToken: string

  constructor(provider: string, apiToken: string) {
    this.provider = provider
    this.apiToken = apiToken
  }

  async createIncident(data: {
    title: string
    description?: string
    impact: 'minor' | 'major' | 'critical'
    components?: string[]
  }) {
    try {
      if (this.provider === 'statuspage') {
        return await this.createStatuspageIncident(data)
      } else if (this.provider === 'betterstack') {
        return await this.createBetterStackIncident(data)
      }
      
      // Mock response si no hay provider configurado
      return {
        id: `mock-${Date.now()}`,
        url: 'https://status.example.com/incidents/mock'
      }
    } catch (error) {
      console.error('Error creating external incident:', error)
      return null
    }
  }

  async updateIncident(incidentId: string, data: {
    status: string
    message: string
  }) {
    try {
      if (this.provider === 'statuspage') {
        return await this.updateStatuspageIncident(incidentId, data)
      } else if (this.provider === 'betterstack') {
        return await this.updateBetterStackIncident(incidentId, data)
      }
      
      // Mock response
      return { success: true }
    } catch (error) {
      console.error('Error updating external incident:', error)
      return null
    }
  }

  private async createStatuspageIncident(data: any) {
    // Statuspage API implementation
    const response = await fetch('https://api.statuspage.io/v1/pages/YOUR_PAGE_ID/incidents', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        incident: {
          name: data.title,
          body: data.description || '',
          status: 'investigating',
          impact_override: data.impact,
          component_ids: data.components || []
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Statuspage API error: ${response.status}`)
    }

    const result = await response.json()
    return {
      id: result.id,
      url: result.shortlink
    }
  }

  private async updateStatuspageIncident(incidentId: string, data: any) {
    const response = await fetch(`https://api.statuspage.io/v1/pages/YOUR_PAGE_ID/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `OAuth ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        incident: {
          status: data.status,
          body: data.message
        }
      })
    })

    return response.ok
  }

  private async createBetterStackIncident(data: any) {
    // BetterStack (formerly UptimeRobot) API implementation
    const response = await fetch('https://betterstack.com/api/v2/incidents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: data.title,
        summary: data.description || '',
        status: 'investigating',
        impact: data.impact
      })
    })

    if (!response.ok) {
      throw new Error(`BetterStack API error: ${response.status}`)
    }

    const result = await response.json()
    return {
      id: result.data.id,
      url: result.data.url
    }
  }

  private async updateBetterStackIncident(incidentId: string, data: any) {
    const response = await fetch(`https://betterstack.com/api/v2/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: data.status,
        summary: data.message
      })
    })

    return response.ok
  }
}

// Función para mapear severidad a impacto
function mapSeverityToImpact(severity: string): 'minor' | 'major' | 'critical' {
  const impactMap = {
    'P1': 'critical' as const,
    'P2': 'major' as const,
    'P3': 'minor' as const
  }
  return impactMap[severity as keyof typeof impactMap] || 'minor'
}

// Función para enviar notificación a Slack
async function sendSlackNotification(webhook: string, incident: any, action: string) {
  try {
    const severityEmoji = {
      'P1': '🔴',
      'P2': '🟡',
      'P3': '🟢'
    }

    const statusEmoji = {
      'investigating': '🔍',
      'identified': '✅',
      'monitoring': '👀',
      'resolved': '✅'
    }

    const message = {
      text: `${action === 'create' ? '🚨 Nuevo Incidente' : '📝 Actualización de Incidente'}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${severityEmoji[incident.severity]} ${incident.title}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severidad:* ${incident.severity}`
            },
            {
              type: 'mrkdwn',
              text: `*Estado:* ${statusEmoji[incident.status]} ${incident.status}`
            },
            {
              type: 'mrkdwn',
              text: `*Impacto:* ${incident.impact || 'Por determinar'}`
            },
            {
              type: 'mrkdwn',
              text: `*Servicios:* ${incident.affected_services?.join(', ') || 'Ninguno especificado'}`
            }
          ]
        }
      ]
    }

    if (incident.description) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Descripción:*\\n${incident.description}`
        }
      })
    }

    if (incident.eta) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*ETA de Resolución:* ${new Date(incident.eta).toLocaleString('es-MX')}`
        }
      })
    }

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
  } catch (error) {
    console.error('Error sending Slack notification:', error)
  }
}

export const handler: Handler = async (event) => {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'POST',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    // Validar variables de entorno
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const statusProvider = process.env.STATUS_PROVIDER || 'mock'
    const statusApiToken = process.env.STATUSPAGE_API_TOKEN || process.env.BETTERSTACK_API_TOKEN
    const slackWebhook = process.env.SLACK_WEBHOOK_URL

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuración de Supabase faltante')
    }

    // Parsear y validar entrada
    const body = JSON.parse(event.body || '{}')
    const validatedData = incidentSchema.parse(body)

    // Inicializar clientes
    const supabase = createClient(supabaseUrl, supabaseKey)
    const statusClient = statusApiToken ? new StatusProvider(statusProvider, statusApiToken) : null

    let result: any = {}

    if (validatedData.action === 'create') {
      // Crear nuevo incidente
      const incidentData = {
        tenant_id: validatedData.tenant_id || null,
        title: validatedData.title!,
        description: validatedData.description || null,
        severity: validatedData.severity!,
        status: 'investigating',
        impact: validatedData.impact || null,
        affected_services: validatedData.affected_services || [],
        eta: validatedData.eta || null,
        created_by: validatedData.by_user || 'system',
        postmortem_required: validatedData.severity === 'P1' // P1 requiere postmortem
      }

      // Crear en status provider externo
      let externalIncident = null
      if (statusClient) {
        externalIncident = await statusClient.createIncident({
          title: incidentData.title,
          description: incidentData.description || '',
          impact: mapSeverityToImpact(incidentData.severity),
          components: incidentData.affected_services
        })
      }

      if (externalIncident) {
        incidentData.status_provider_id = externalIncident.id
      }

      // Insertar en Supabase
      const { data: incident, error } = await supabase
        .from('incidents')
        .insert(incidentData)
        .select()
        .single()

      if (error) {
        throw new Error(`Error al crear incidente: ${error.message}`)
      }

      // Crear update inicial
      await supabase
        .from('incident_updates')
        .insert({
          incident_id: incident.id,
          status: 'investigating',
          message: validatedData.description || 'Incidente creado',
          by_user: validatedData.by_user || 'system',
          published_externally: !!externalIncident
        })

      // Notificar en Slack si es P1 o P2
      if (slackWebhook && ['P1', 'P2'].includes(incident.severity)) {
        await sendSlackNotification(slackWebhook, incident, 'create')
      }

      result = {
        action: 'created',
        incident: {
          id: incident.id,
          title: incident.title,
          severity: incident.severity,
          status: incident.status,
          external_url: externalIncident?.url || null,
          created_at: incident.created_at
        }
      }

    } else if (validatedData.action === 'update' || validatedData.action === 'resolve') {
      // Actualizar incidente existente
      const incidentId = validatedData.incident_id!
      
      // Obtener incidente actual
      const { data: existingIncident, error: fetchError } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', incidentId)
        .single()

      if (fetchError || !existingIncident) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Incidente no encontrado' })
        }
      }

      // Preparar datos de actualización
      const updateData: any = {
        updated_at: new Date().toISOString()
      }

      let newStatus = validatedData.status
      if (validatedData.action === 'resolve') {
        newStatus = 'resolved'
      }

      if (newStatus && newStatus !== existingIncident.status) {
        updateData.status = newStatus
        
        // Si se resuelve, marcar postmortem como pendiente si es requerido
        if (newStatus === 'resolved' && existingIncident.postmortem_required) {
          updateData.postmortem_completed = false
        }
      }

      // Actualizar en Supabase
      const { error: updateError } = await supabase
        .from('incidents')
        .update(updateData)
        .eq('id', incidentId)

      if (updateError) {
        throw new Error(`Error al actualizar incidente: ${updateError.message}`)
      }

      // Actualizar en status provider externo
      if (statusClient && existingIncident.status_provider_id && validatedData.update_message) {
        await statusClient.updateIncident(existingIncident.status_provider_id, {
          status: newStatus || existingIncident.status,
          message: validatedData.update_message
        })
      }

      // Crear update
      if (validatedData.update_message) {
        await supabase
          .from('incident_updates')
          .insert({
            incident_id: incidentId,
            status: newStatus || existingIncident.status,
            message: validatedData.update_message,
            by_user: validatedData.by_user || 'system',
            published_externally: !!statusClient
          })
      }

      // Notificar resolución en Slack
      if (slackWebhook && newStatus === 'resolved' && ['P1', 'P2'].includes(existingIncident.severity)) {
        await sendSlackNotification(slackWebhook, {
          ...existingIncident,
          status: newStatus
        }, 'resolve')
      }

      result = {
        action: validatedData.action,
        incident: {
          id: incidentId,
          status: newStatus || existingIncident.status,
          updated_at: updateData.updated_at
        }
      }
    }

    // Log de éxito
    console.log('Incident processed successfully', {
      action: validatedData.action,
      incidentId: result.incident?.id,
      severity: validatedData.severity,
      hasExternalProvider: !!statusClient
    })

    // Respuesta exitosa
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        ...result
      })
    }

  } catch (error: any) {
    console.error('Error in status-incident function:', error)

    // Manejo de errores de validación
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ok: false,
          error: 'Datos de entrada inválidos',
          details: error.errors
        })
      }
    }

    // Error genérico
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: false,
        error: 'Error interno del servidor',
        message: error.message
      })
    }
  }
}