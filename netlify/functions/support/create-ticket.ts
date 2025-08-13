import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Validación de entrada
const createTicketSchema = z.object({
  tenantId: z.string().uuid(),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: z.enum(['P1', 'P2', 'P3']),
  channel: z.enum(['email', 'chat', 'slack']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.any()).optional().default({}),
  createdBy: z.string().uuid().optional()
})

// Cliente HubSpot Service Hub
class HubSpotClient {
  private apiToken: string
  private baseUrl = 'https://api.hubapi.com/crm/v3/objects/tickets'

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  async createTicket(ticketData: {
    subject: string
    description: string
    severity: string
    source: string
    tenantId: string
  }) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            subject: ticketData.subject,
            content: ticketData.description,
            hs_ticket_priority: ticketData.severity,
            source_type: ticketData.source,
            hs_pipeline: 'support',
            hs_pipeline_stage: 'open',
            tenant_id: ticketData.tenantId,
            created_via: 'RP9_Portal'
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return {
        id: result.id,
        url: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/ticket/${result.id}`
      }
    } catch (error) {
      console.error('Error creating HubSpot ticket:', error)
      // No fallar si HubSpot no está disponible, solo loguear
      return null
    }
  }
}

// Función para calcular SLA/FRT
async function calculateSLA(supabase: any, severity: string, tenantId: string) {
  try {
    // Obtener plan del tenant (simplificado, en prod vendría de tenant config)
    const plan = 'pro' // Por ahora hardcoded, después obtener del tenant
    
    const { data: slaData } = await supabase
      .from('sla_matrix')
      .select('frt_minutes, restore_minutes')
      .eq('plan_key', plan)
      .eq('severity', severity)
      .single()

    if (!slaData) {
      // SLA por defecto si no se encuentra
      return {
        frt_minutes: severity === 'P1' ? 60 : severity === 'P2' ? 240 : 480,
        restore_minutes: severity === 'P1' ? 120 : severity === 'P2' ? 480 : 2880
      }
    }

    return slaData
  } catch (error) {
    console.error('Error calculating SLA:', error)
    // Retornar SLA por defecto en caso de error
    return {
      frt_minutes: 240,
      restore_minutes: 480
    }
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
    const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuración de Supabase faltante')
    }

    // Parsear y validar entrada
    const body = JSON.parse(event.body || '{}')
    const validatedData = createTicketSchema.parse(body)

    // Inicializar clientes
    const supabase = createClient(supabaseUrl, supabaseKey)
    const hubspot = hubspotToken ? new HubSpotClient(hubspotToken) : null

    // Calcular SLA para este ticket
    const slaData = await calculateSLA(supabase, validatedData.severity, validatedData.tenantId)
    
    // Crear ticket en HubSpot (si está configurado)
    let hubspotTicket = null
    if (hubspot) {
      hubspotTicket = await hubspot.createTicket({
        subject: validatedData.subject,
        description: validatedData.description,
        severity: validatedData.severity,
        source: validatedData.channel,
        tenantId: validatedData.tenantId
      })
    }

    // Crear ticket en Supabase
    const ticketData = {
      tenant_id: validatedData.tenantId,
      subject: validatedData.subject,
      description: validatedData.description,
      severity: validatedData.severity,
      channel: validatedData.channel,
      priority: validatedData.priority,
      tags: validatedData.tags,
      metadata: {
        ...validatedData.metadata,
        sla_frt_minutes: slaData.frt_minutes,
        sla_restore_minutes: slaData.restore_minutes,
        frt_due_at: new Date(Date.now() + slaData.frt_minutes * 60000).toISOString(),
        restore_due_at: new Date(Date.now() + slaData.restore_minutes * 60000).toISOString()
      },
      hubspot_ticket_id: hubspotTicket?.id || null,
      created_by: validatedData.createdBy || null,
      status: 'open'
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select()
      .single()

    if (error) {
      throw new Error(`Error al crear ticket en BD: ${error.message}`)
    }

    // Crear evento inicial
    await supabase
      .from('ticket_events')
      .insert({
        ticket_id: ticket.id,
        type: 'created',
        by_user: 'system',
        meta: {
          channel: validatedData.channel,
          severity: validatedData.severity,
          hubspot_id: hubspotTicket?.id || null
        }
      })

    // Log estructurado
    console.log('Ticket created successfully', {
      ticketId: ticket.id,
      tenantId: validatedData.tenantId,
      severity: validatedData.severity,
      hubspotId: hubspotTicket?.id || null,
      sla: slaData
    })

    // Respuesta exitosa
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        ticket: {
          id: ticket.id,
          subject: ticket.subject,
          severity: ticket.severity,
          status: ticket.status,
          sla: {
            frt_minutes: slaData.frt_minutes,
            restore_minutes: slaData.restore_minutes,
            frt_due_at: ticketData.metadata.frt_due_at,
            restore_due_at: ticketData.metadata.restore_due_at
          },
          hubspot: hubspotTicket ? {
            id: hubspotTicket.id,
            url: hubspotTicket.url
          } : null,
          created_at: ticket.created_at
        }
      })
    }

  } catch (error: any) {
    console.error('Error in create-ticket function:', error)

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