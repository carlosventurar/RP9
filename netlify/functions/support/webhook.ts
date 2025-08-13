import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'crypto'

// Validación del webhook de HubSpot
const hubspotWebhookSchema = z.object({
  subscriptionId: z.number(),
  portalId: z.number(),
  appId: z.number(),
  occurredAt: z.number(),
  subscriptionType: z.string(),
  attemptNumber: z.number(),
  objectId: z.number(),
  changeSource: z.string(),
  eventId: z.number(),
  propertyName: z.string().optional(),
  propertyValue: z.string().optional()
})

// Esquema para batch de eventos
const batchWebhookSchema = z.array(hubspotWebhookSchema)

// Función para verificar signature de HubSpot
function verifyHubSpotSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(hash, 'hex')
    )
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

// Cliente para obtener detalles del ticket de HubSpot
class HubSpotClient {
  private apiToken: string
  private baseUrl = 'https://api.hubapi.com/crm/v3/objects/tickets'

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  async getTicket(ticketId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/${ticketId}?properties=subject,content,hs_ticket_priority,hs_pipeline_stage,hs_lastmodifieddate,tenant_id,closedate`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HubSpot API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching HubSpot ticket:', error)
      return null
    }
  }
}

// Mapear estados de HubSpot a nuestros estados
function mapHubSpotStatus(hubspotStage: string): string {
  const statusMap: Record<string, string> = {
    'open': 'open',
    'waiting_on_contact': 'waiting',
    'waiting_on_us': 'in_progress',
    'closed': 'resolved'
  }
  
  return statusMap[hubspotStage] || 'open'
}

// Mapear prioridad de HubSpot a severidad
function mapHubSpotPriority(hubspotPriority: string): string {
  const priorityMap: Record<string, string> = {
    'LOW': 'P3',
    'MEDIUM': 'P2',
    'HIGH': 'P1'
  }
  
  return priorityMap[hubspotPriority] || 'P2'
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
    const hubspotSecret = process.env.HUBSPOT_WEBHOOK_SECRET

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuración de Supabase faltante')
    }

    if (!hubspotToken) {
      throw new Error('Token de HubSpot faltante')
    }

    const rawBody = event.body || ''
    
    // Verificar signature si está configurado
    if (hubspotSecret) {
      const signature = event.headers['x-hubspot-signature-v3'] || event.headers['X-HubSpot-Signature-v3']
      
      if (!signature || !verifyHubSpotSignature(rawBody, signature, hubspotSecret)) {
        console.error('Invalid HubSpot signature')
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Signature inválida' })
        }
      }
    }

    // Parsear y validar webhook
    const webhookData = JSON.parse(rawBody)
    
    // Puede ser un evento único o un batch
    const events = Array.isArray(webhookData) ? webhookData : [webhookData]
    const validatedEvents = batchWebhookSchema.parse(events)

    // Inicializar clientes
    const supabase = createClient(supabaseUrl, supabaseKey)
    const hubspot = new HubSpotClient(hubspotToken)

    const results = []

    // Procesar cada evento
    for (const event of validatedEvents) {
      try {
        // Solo procesar eventos de tickets
        if (event.subscriptionType !== 'ticket.propertyChange' && 
            event.subscriptionType !== 'ticket.creation' &&
            event.subscriptionType !== 'ticket.deletion') {
          console.log(`Skipping event type: ${event.subscriptionType}`)
          continue
        }

        const hubspotTicketId = event.objectId.toString()
        
        // Buscar ticket en nuestra BD por hubspot_ticket_id
        const { data: existingTicket } = await supabase
          .from('tickets')
          .select('*')
          .eq('hubspot_ticket_id', hubspotTicketId)
          .single()

        if (!existingTicket) {
          console.log(`Ticket not found in DB: ${hubspotTicketId}`)
          continue
        }

        // Obtener detalles actualizados del ticket
        const hubspotTicket = await hubspot.getTicket(hubspotTicketId)
        
        if (!hubspotTicket) {
          console.error(`Could not fetch HubSpot ticket: ${hubspotTicketId}`)
          continue
        }

        const properties = hubspotTicket.properties
        
        // Preparar datos de actualización
        const updateData: any = {}
        const eventMeta: any = {
          hubspot_event_id: event.eventId,
          change_source: event.changeSource,
          occurred_at: new Date(event.occurredAt).toISOString()
        }

        // Mapear cambios específicos
        if (properties.hs_pipeline_stage !== existingTicket.status) {
          const newStatus = mapHubSpotStatus(properties.hs_pipeline_stage)
          updateData.status = newStatus
          eventMeta.status_change = {
            from: existingTicket.status,
            to: newStatus
          }
          
          // Si se resolvió, marcar timestamp
          if (newStatus === 'resolved' && !existingTicket.resolved_at) {
            updateData.resolved_at = new Date().toISOString()
          }
        }

        if (properties.hs_ticket_priority) {
          const newSeverity = mapHubSpotPriority(properties.hs_ticket_priority)
          if (newSeverity !== existingTicket.severity) {
            updateData.severity = newSeverity
            eventMeta.severity_change = {
              from: existingTicket.severity,
              to: newSeverity
            }
          }
        }

        if (properties.subject && properties.subject !== existingTicket.subject) {
          updateData.subject = properties.subject
          eventMeta.subject_updated = true
        }

        // Solo actualizar si hay cambios
        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date().toISOString()
          
          const { error: updateError } = await supabase
            .from('tickets')
            .update(updateData)
            .eq('id', existingTicket.id)

          if (updateError) {
            throw new Error(`Error updating ticket: ${updateError.message}`)
          }

          // Crear evento de cambio
          await supabase
            .from('ticket_events')
            .insert({
              ticket_id: existingTicket.id,
              type: 'hubspot_sync',
              by_user: 'hubspot_webhook',
              meta: eventMeta
            })

          console.log('Ticket synchronized', {
            ticketId: existingTicket.id,
            hubspotId: hubspotTicketId,
            changes: Object.keys(updateData)
          })
        }

        results.push({
          hubspotId: hubspotTicketId,
          ticketId: existingTicket.id,
          processed: true,
          changes: Object.keys(updateData)
        })

      } catch (eventError: any) {
        console.error('Error processing webhook event:', eventError)
        results.push({
          hubspotId: event.objectId.toString(),
          processed: false,
          error: eventError.message
        })
      }
    }

    // Respuesta exitosa
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        processed: results.length,
        results
      })
    }

  } catch (error: any) {
    console.error('Error in support webhook:', error)

    // Manejo de errores de validación
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ok: false,
          error: 'Formato de webhook inválido',
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
        error: 'Error procesando webhook',
        message: error.message
      })
    }
  }
}