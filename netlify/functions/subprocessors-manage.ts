import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Schema for subprocessor operations
const subprocessorSchema = z.object({
  action: z.enum(['list', 'create', 'update', 'delete', 'notify']),
  id: z.string().uuid().optional(),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    purpose: z.string().optional(),
    data_categories: z.array(z.string()).optional(),
    location: z.string().optional(),
    certification: z.array(z.string()).optional(),
    website_url: z.string().url().optional(),
    privacy_policy_url: z.string().url().optional()
  }).optional(),
  notification_type: z.enum(['addition', 'modification', 'removal']).optional()
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Send notification emails (placeholder)
async function sendSubprocessorNotification(
  subscriberEmail: string,
  notificationType: string,
  subprocessorName: string,
  changeDetails: string
) {
  // In production, integrate with email service (Resend, SendGrid, etc.)
  console.log(`Email notification sent to ${subscriberEmail}:`)
  console.log(`Subject: Cambio en Subprocesadores - ${subprocessorName}`)
  console.log(`Type: ${notificationType}`)
  console.log(`Details: ${changeDetails}`)
  
  return true // Placeholder success
}

// Notify all subscribers about subprocessor changes
async function notifySubscribers(notificationType: string, subprocessorName: string, changeDetails: string) {
  const { data: subscriptions, error } = await supabase
    .from('subprocessor_subscriptions')
    .select('email, tenant_id')
    .is('unsubscribed_at', null)

  if (error) {
    throw new Error(`Failed to fetch subscriptions: ${error.message}`)
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No active subscriptions found')
    return 0
  }

  let notificationsSent = 0
  for (const subscription of subscriptions) {
    try {
      await sendSubprocessorNotification(
        subscription.email,
        notificationType,
        subprocessorName,
        changeDetails
      )
      notificationsSent++
    } catch (error) {
      console.error(`Failed to send notification to ${subscription.email}:`, error)
    }
  }

  return notificationsSent
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  try {
    // Handle GET requests (list subprocessors)
    if (event.httpMethod === 'GET') {
      const { data: subprocessors, error } = await supabase
        .from('subprocessors')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (error) {
        throw new Error(`Failed to fetch subprocessors: ${error.message}`)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          subprocessors: subprocessors || []
        })
      }
    }

    // Handle POST/PUT/DELETE requests
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Request body required' })
      }
    }

    const requestData = JSON.parse(event.body)
    const validation = subprocessorSchema.safeParse(requestData)
    
    if (!validation.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Validation failed',
          details: validation.error.issues
        })
      }
    }

    const { action, id, data, notification_type } = validation.data

    switch (action) {
      case 'list':
        const { data: subprocessors, error: listError } = await supabase
          .from('subprocessors')
          .select('*')
          .eq('status', 'active')
          .order('name')

        if (listError) throw new Error(listError.message)

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, subprocessors })
        }

      case 'create':
        if (!data) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Subprocessor data required' })
          }
        }

        const { data: newSubprocessor, error: createError } = await supabase
          .from('subprocessors')
          .insert({
            ...data,
            added_date: new Date().toISOString(),
            last_reviewed: new Date().toISOString(),
            status: 'active'
          })
          .select()
          .single()

        if (createError) throw new Error(createError.message)

        // Notify subscribers
        await notifySubscribers(
          'addition',
          data.name || 'Nuevo Subprocesador',
          `Se ha añadido un nuevo subprocesador: ${data.name}. Propósito: ${data.purpose}`
        )

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            subprocessor: newSubprocessor
          })
        }

      case 'notify':
        // Manual notification trigger
        const notificationCount = await notifySubscribers(
          notification_type || 'modification',
          'Actualización de Subprocesadores',
          'Se han realizado cambios en nuestra lista de subprocesadores. Revise la lista actualizada.'
        )

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            notifications_sent: notificationCount
          })
        }

      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid action' })
        }
    }

  } catch (error) {
    console.error('Error in subprocessors-manage:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

export { subprocessorSchema, sendSubprocessorNotification }