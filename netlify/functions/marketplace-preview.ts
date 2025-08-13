import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { verifySignature } from '../lib/security/hmac'
import { checkRateLimit } from '../lib/security/rateLimit'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FREE_PREVIEW_EXECUTIONS = parseInt(process.env.FREE_PREVIEW_EXECUTIONS || '5')

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature, X-Timestamp',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    }
  }

  try {
    const {
      item_slug,
      tenant_id,
      preview_token_id,
      execution_data = {},
      mock_mode = true
    } = event.httpMethod === 'POST' 
      ? JSON.parse(event.body || '{}')
      : event.queryStringParameters || {}

    if (!item_slug || !tenant_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required parameters: item_slug, tenant_id'
        })
      }
    }

    // Rate limiting por tenant (max 20 previews por hora)
    const rateLimitKey = `preview_${tenant_id}`
    const rateLimitOk = await checkRateLimit(rateLimitKey, 20)
    
    if (!rateLimitOk) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Preview rate limit exceeded. Please try again later.',
          retry_after: 3600 // 1 hour
        })
      }
    }

    // Verificar HMAC si se proporciona (para requests autenticadas)
    const signature = event.headers['x-signature']
    const timestamp = event.headers['x-timestamp']
    
    if (signature && timestamp && event.body) {
      const isValidSignature = verifySignature(
        event.body,
        timestamp,
        signature,
        process.env.ANALYTICS_WEBHOOK_SECRET!,
        300 // 5 minutos
      )

      if (!isValidSignature) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid request signature'
          })
        }
      }
    }

    if (event.httpMethod === 'GET') {
      return await handleGetPreviewToken(item_slug, tenant_id, headers)
    } else if (event.httpMethod === 'POST') {
      return await handleExecutePreview(
        item_slug, 
        tenant_id, 
        preview_token_id, 
        execution_data, 
        mock_mode,
        headers
      )
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Marketplace preview error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Handler: Obtener token de preview (crear si no existe)
async function handleGetPreviewToken(itemSlug: string, tenantId: string, headers: any) {
  try {
    // Obtener item
    const { data: item, error: itemError } = await supabase
      .from('marketplace_items')
      .select('id, title, tier, status')
      .eq('slug', itemSlug)
      .eq('status', 'approved')
      .single()

    if (itemError || !item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Template not found or not available for preview'
        })
      }
    }

    // Buscar token existente válido
    const { data: existingToken } = await supabase
      .from('preview_tokens')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('item_id', item.id)
      .gte('expires_at', new Date().toISOString())
      .single()

    let token = existingToken

    // Crear nuevo token si no existe o expiró
    if (!token || token.remaining <= 0) {
      const { data: newToken, error: tokenError } = await supabase
        .from('preview_tokens')
        .insert({
          tenant_id: tenantId,
          item_id: item.id,
          remaining: FREE_PREVIEW_EXECUTIONS,
          daily_limit: FREE_PREVIEW_EXECUTIONS,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (tokenError) {
        console.error('Failed to create preview token:', tokenError)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Failed to create preview token'
          })
        }
      }

      token = newToken
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          token_id: token.id,
          item: {
            id: item.id,
            title: item.title,
            tier: item.tier
          },
          preview_limits: {
            remaining: token.remaining,
            daily_limit: token.daily_limit,
            expires_at: token.expires_at
          },
          instructions: {
            es: `Tienes ${token.remaining} ejecuciones gratis para probar este template. Los datos son simulados.`,
            en: `You have ${token.remaining} free executions to test this template. Data is mocked.`
          }
        }
      })
    }

  } catch (error) {
    console.error('Error getting preview token:', error)
    throw error
  }
}

// Handler: Ejecutar preview del template
async function handleExecutePreview(
  itemSlug: string, 
  tenantId: string, 
  tokenId: string | undefined,
  executionData: any,
  mockMode: boolean,
  headers: any
) {
  try {
    // Validar token
    const { data: token, error: tokenError } = await supabase
      .from('preview_tokens')
      .select(`
        *,
        marketplace_items!preview_tokens_item_id_fkey (
          id, slug, title, tier, metadata
        )
      `)
      .eq('id', tokenId)
      .eq('tenant_id', tenantId)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (tokenError || !token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid or expired preview token'
        })
      }
    }

    if (token.remaining <= 0) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Preview executions limit reached',
          limits: {
            remaining: 0,
            daily_limit: token.daily_limit,
            expires_at: token.expires_at
          }
        })
      }
    }

    const item = token.marketplace_items

    // Ejecutar preview
    let executionResult
    if (mockMode) {
      // Modo mock: simular ejecución sin llamar a n8n real
      executionResult = await executeMockPreview(item, executionData)
    } else {
      // Modo real: ejecutar en n8n sandbox (limitado)
      executionResult = await executeRealPreview(item, executionData, tenantId)
    }

    // Decrementar remaining executions
    const { error: updateError } = await supabase
      .from('preview_tokens')
      .update({ 
        remaining: token.remaining - 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', token.id)

    if (updateError) {
      console.warn('Failed to update preview token:', updateError)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          execution_id: executionResult.id,
          status: executionResult.status,
          result: executionResult.result,
          duration_ms: executionResult.duration,
          mock_mode: mockMode,
          preview_limits: {
            remaining: token.remaining - 1,
            daily_limit: token.daily_limit,
            expires_at: token.expires_at
          },
          warnings: executionResult.warnings || []
        }
      })
    }

  } catch (error) {
    console.error('Error executing preview:', error)
    throw error
  }
}

// Mock execution: simular resultados sin n8n real
async function executeMockPreview(item: any, inputData: any) {
  const startTime = Date.now()
  
  // Simular tiempo de procesamiento (100-500ms)
  const simulatedDelay = Math.random() * 400 + 100
  await new Promise(resolve => setTimeout(resolve, simulatedDelay))

  // Generar resultado mock basado en el tipo de template
  const category = item.metadata?.category || 'general'
  const mockResult = generateMockResult(category, inputData)

  return {
    id: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    status: 'completed',
    result: mockResult,
    duration: Date.now() - startTime,
    warnings: [
      'Este es un preview con datos simulados',
      'La ejecución real puede tener resultados diferentes',
      'Algunos conectores externos no se ejecutan en modo preview'
    ]
  }
}

// Real execution: ejecutar en n8n con limitaciones
async function executeRealPreview(item: any, inputData: any, tenantId: string) {
  const startTime = Date.now()

  try {
    // Obtener workflow JSON del storage (versión más reciente)
    const { data: latestVersion } = await supabase
      .from('item_versions')
      .select('json_url, version')
      .eq('item_id', item.id)
      .eq('passed_lint', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!latestVersion?.json_url) {
      throw new Error('Template workflow not available')
    }

    // TODO: Implementar ejecución real en n8n
    // Por ahora, retornar mock para evitar llamadas reales
    const mockResult = generateMockResult(item.metadata?.category || 'general', inputData)

    return {
      id: `preview_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'completed',
      result: mockResult,
      duration: Date.now() - startTime,
      warnings: [
        'Preview ejecutado en modo sandbox',
        'Algunos conectores pueden estar limitados',
        'Los datos reales pueden diferir'
      ]
    }

  } catch (error) {
    return {
      id: `error_${Date.now()}`,
      status: 'failed',
      result: {
        error: error instanceof Error ? error.message : 'Execution failed',
        type: 'preview_error'
      },
      duration: Date.now() - startTime,
      warnings: ['Error ejecutando preview']
    }
  }
}

// Generar resultados mock por categoría
function generateMockResult(category: string, inputData: any): any {
  const baseResult = {
    execution_id: `mock_${Date.now()}`,
    timestamp: new Date().toISOString(),
    input_data: inputData,
    preview_mode: true
  }

  switch (category) {
    case 'cc':
    case 'contact_center':
      return {
        ...baseResult,
        customer_data: {
          name: 'Juan Pérez',
          email: 'juan.perez@ejemplo.com',
          phone: '+52 555 123 4567',
          issue_type: 'Consulta general'
        },
        ticket_created: {
          ticket_id: 'TKT-2024-001234',
          status: 'open',
          priority: 'medium',
          assigned_agent: 'Ana García'
        },
        notifications_sent: ['email', 'slack'],
        estimated_resolution: '2 hours'
      }

    case 'fin':
    case 'finance':
      return {
        ...baseResult,
        invoice_data: {
          invoice_number: 'INV-2024-001',
          amount: 1250.00,
          currency: 'MXN',
          due_date: '2024-09-15'
        },
        payment_processed: true,
        accounting_entry: {
          debit_account: '1100 - Cuentas por cobrar',
          credit_account: '4000 - Ingresos por servicios',
          amount: 1250.00
        },
        notifications_sent: ['client_email', 'accounting_team']
      }

    case 'wa':
    case 'whatsapp':
      return {
        ...baseResult,
        message_sent: {
          recipient: '+52 555 987 6543',
          message_id: 'wa_msg_' + Math.random().toString(36).substring(2, 10),
          status: 'delivered',
          template_used: 'welcome_customer'
        },
        automation_triggered: 'follow_up_sequence',
        next_action_scheduled: '2024-08-14T14:30:00Z'
      }

    case 'ecommerce':
      return {
        ...baseResult,
        order_processed: {
          order_id: 'ORD-' + Date.now().toString().slice(-6),
          customer: 'María González',
          items: [
            { name: 'Producto A', quantity: 2, price: 299.99 },
            { name: 'Producto B', quantity: 1, price: 149.99 }
          ],
          total: 749.97,
          status: 'processing'
        },
        inventory_updated: true,
        shipping_label_created: true,
        customer_notified: true
      }

    default:
      return {
        ...baseResult,
        processed_items: Math.floor(Math.random() * 10) + 1,
        success_rate: Math.floor(Math.random() * 20) + 80, // 80-100%
        output_data: {
          status: 'completed',
          message: 'Preview executed successfully',
          records_processed: Math.floor(Math.random() * 50) + 10
        }
      }
  }
}