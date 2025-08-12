import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WorkflowPayload {
  name: string
  active: boolean
  nodes: any[]
  connections?: any
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { mockWorkflow, realWorkflow, vertical, tenantId } = JSON.parse(event.body || '{}')

    if (!mockWorkflow || !realWorkflow) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing mockWorkflow or realWorkflow' })
      }
    }

    const n8nBaseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '')
    const n8nApiKey = process.env.N8N_API_KEY

    if (!n8nBaseUrl || !n8nApiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'N8N configuration missing' })
      }
    }

    const results = { mock: null, real: null, errors: [] }

    // Install mock workflow
    try {
      const mockResponse = await fetch(`${n8nBaseUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(mockWorkflow)
      })

      if (mockResponse.ok) {
        const mockData = await mockResponse.json()
        results.mock = mockData
        console.log('Mock workflow created:', mockData.id)
        
        // Execute mock workflow immediately if it has manual trigger
        if (mockWorkflow.nodes.some((node: any) => node.type === 'n8n-nodes-base.manualTrigger')) {
          try {
            const executeResponse = await fetch(`${n8nBaseUrl}/api/v1/workflows/${mockData.id}/run`, {
              method: 'POST',
              headers: {
                'X-N8N-API-KEY': n8nApiKey,
                'Content-Type': 'application/json'
              }
            })
            
            if (executeResponse.ok) {
              console.log('Mock workflow executed successfully')
            }
          } catch (execError) {
            console.warn('Failed to execute mock workflow:', execError)
          }
        }
      } else {
        const errorText = await mockResponse.text()
        results.errors.push(`Mock workflow: ${mockResponse.status} ${errorText}`)
      }
    } catch (error) {
      results.errors.push(`Mock workflow error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Install real workflow
    try {
      const realResponse = await fetch(`${n8nBaseUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(realWorkflow)
      })

      if (realResponse.ok) {
        const realData = await realResponse.json()
        results.real = realData
        console.log('Real workflow created:', realData.id)
      } else {
        const errorText = await realResponse.text()
        results.errors.push(`Real workflow: ${realResponse.status} ${errorText}`)
      }
    } catch (error) {
      results.errors.push(`Real workflow error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Create activation events for successful installations
    if (results.mock || results.real) {
      try {
        // Get tenant info if provided or try to determine from auth
        let targetTenantId = tenantId

        if (!targetTenantId) {
          // Try to get tenant from authorization header or context
          // This is a simplified approach - in production you'd have proper auth middleware
          console.warn('No tenant ID provided for activation event')
        }

        if (targetTenantId) {
          const events = []
          
          if (results.mock) {
            events.push({
              tenant_id: targetTenantId,
              type: 'template_installed',
              workflow_id: results.mock.id,
              meta: {
                template_type: 'mock',
                vertical: vertical || 'unknown',
                source: 'onboarding_wizard'
              }
            })
          }
          
          if (results.real) {
            events.push({
              tenant_id: targetTenantId,
              type: 'template_installed',
              workflow_id: results.real.id,
              meta: {
                template_type: 'real',
                vertical: vertical || 'unknown',
                source: 'onboarding_wizard'
              }
            })
          }

          if (events.length > 0) {
            const { error: activationError } = await supabase
              .from('activation_events')
              .insert(events)

            if (activationError) {
              console.error('Error creating activation events:', activationError)
            }
          }
        }
      } catch (eventError) {
        console.error('Error handling activation events:', eventError)
        // Don't fail the main operation
      }
    }

    // Determine response status
    const hasSuccesses = results.mock || results.real
    const hasErrors = results.errors.length > 0

    return {
      statusCode: hasSuccesses ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: hasSuccesses,
        results,
        message: hasSuccesses 
          ? `Successfully installed ${[results.mock && 'mock', results.real && 'real'].filter(Boolean).join(' and ')} workflow(s)`
          : 'Failed to install workflows',
        installed_count: [results.mock, results.real].filter(Boolean).length
      })
    }

  } catch (error) {
    console.error('Error installing templates:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}