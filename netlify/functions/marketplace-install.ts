import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const N8N_BASE_URL = process.env.N8N_BASE_URL!
const N8N_API_KEY = process.env.N8N_API_KEY!

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const {
      item_slug,
      tenant_id,
      user_id,
      custom_name,
      auto_update_enabled = true,
      install_settings = {}
    } = JSON.parse(event.body || '{}')

    if (!item_slug || !tenant_id || !user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: item_slug, tenant_id, user_id'
        })
      }
    }

    // 1. Verificar que el item existe y está aprobado
    const { data: item, error: itemError } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('slug', item_slug)
      .eq('status', 'approved')
      .single()

    if (itemError || !item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Template not found or not available for installation'
        })
      }
    }

    // 2. Verificar licencia/compra si no es gratis
    const isFreePack = !item.one_off_price_cents && !item.subscription_price_cents
    
    if (!isFreePack) {
      const { data: activePurchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('id, kind, status, license_key, expires_at')
        .eq('tenant_id', tenant_id)
        .eq('item_id', item.id)
        .eq('status', 'active')
        .single()

      if (purchaseError || !activePurchase) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'No valid license found. Please purchase this template first.',
            requires_purchase: true,
            item: {
              id: item.id,
              slug: item.slug,
              title: item.title,
              one_off_price_cents: item.one_off_price_cents,
              subscription_price_cents: item.subscription_price_cents
            }
          })
        }
      }

      // Verificar expiración para suscripciones
      if (activePurchase.kind === 'subscription' && activePurchase.expires_at) {
        const expiresAt = new Date(activePurchase.expires_at)
        if (expiresAt < new Date()) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Subscription has expired. Please renew to install.',
              expired_at: activePurchase.expires_at
            })
          }
        }
      }
    }

    // 3. Verificar si ya está instalado
    const { data: existingInstall } = await supabase
      .from('template_installs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('item_id', item.id)
      .single()

    if (existingInstall && existingInstall.status === 'active') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Template already installed',
          existing_install: {
            workflow_id: existingInstall.workflow_id,
            version_installed: existingInstall.version_installed,
            installed_at: existingInstall.created_at
          }
        })
      }
    }

    // 4. Obtener la versión más reciente del workflow JSON
    const { data: latestVersion, error: versionError } = await supabase
      .from('item_versions')
      .select('*')
      .eq('item_id', item.id)
      .eq('passed_lint', true)
      .eq('security_scan_passed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (versionError || !latestVersion) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No valid template version available for installation'
        })
      }
    }

    // 5. Descargar workflow JSON desde storage
    let workflowJson
    try {
      // Aquí normalmente descargarías desde Supabase Storage
      // Por ahora usamos un workflow mock
      workflowJson = await generateMockWorkflowJson(item, install_settings)
    } catch (downloadError) {
      console.error('Failed to download workflow JSON:', downloadError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to download template workflow'
        })
      }
    }

    // 6. Preparar el workflow para instalación
    const workflowName = custom_name || `${item.title} (${item.version})`
    const sanitizedWorkflow = sanitizeWorkflowForTenant(workflowJson, tenant_id, install_settings)

    // 7. Instalar en n8n vía API
    let n8nInstallResult
    try {
      n8nInstallResult = await installWorkflowToN8n(sanitizedWorkflow, workflowName, tenant_id)
    } catch (n8nError) {
      console.error('N8N installation failed:', n8nError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to install workflow in n8n',
          details: n8nError instanceof Error ? n8nError.message : 'Unknown error'
        })
      }
    }

    // 8. Registrar instalación en DB
    const installData = {
      tenant_id,
      item_id: item.id,
      purchase_id: isFreePack ? null : undefined, // Se puede agregar purchase_id lookup
      workflow_id: n8nInstallResult.workflow_id,
      workflow_name: workflowName,
      version_installed: latestVersion.version,
      auto_update_enabled,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    let installRecord
    if (existingInstall) {
      // Actualizar instalación existente (reinstalación)
      const { data: updatedInstall, error: updateError } = await supabase
        .from('template_installs')
        .update(installData)
        .eq('id', existingInstall.id)
        .select()
        .single()

      if (updateError) {
        console.error('Failed to update install record:', updateError)
      } else {
        installRecord = updatedInstall
      }
    } else {
      // Crear nueva instalación
      const { data: newInstall, error: insertError } = await supabase
        .from('template_installs')
        .insert(installData)
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create install record:', insertError)
      } else {
        installRecord = newInstall
      }
    }

    // 9. Incrementar contador de instalaciones (optimista)
    supabase
      .from('marketplace_items')
      .update({ 
        install_count: item.install_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id)
      .then(() => console.log(`Install count incremented for item ${item.id}`))
      .catch(err => console.warn('Failed to increment install count:', err))

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          install_id: installRecord?.id,
          workflow_id: n8nInstallResult.workflow_id,
          workflow_name: workflowName,
          version_installed: latestVersion.version,
          n8n_url: `${N8N_BASE_URL}/workflow/${n8nInstallResult.workflow_id}`,
          item: {
            id: item.id,
            title: item.title,
            version: item.version
          },
          next_steps: [
            'Configure your workflow credentials in n8n',
            'Test the workflow with real data',
            'Monitor executions in the analytics dashboard'
          ],
          auto_update_enabled,
          estimated_setup_time: item.metadata?.setup_time_minutes || 15
        }
      })
    }

  } catch (error) {
    console.error('Marketplace install error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Installation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Mock workflow generation (en producción descargar desde Storage)
async function generateMockWorkflowJson(item: any, settings: any = {}) {
  // Template básico de n8n workflow
  const baseWorkflow = {
    name: item.title,
    nodes: [
      {
        parameters: {},
        name: "When clicking \"Test workflow\"",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [240, 300],
        id: "manual-trigger-1"
      },
      {
        parameters: {
          functionCode: `// ${item.title} - ${item.short_desc}\n// Versión: ${item.version}\n\nconst inputData = $input.all();\nconst results = [];\n\nfor (const item of inputData) {\n  results.push({\n    processed: true,\n    data: item.json,\n    timestamp: new Date().toISOString(),\n    template_id: '${item.id}'\n  });\n}\n\nreturn results;`
        },
        name: `${item.title} Logic`,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [460, 300],
        id: "code-node-1"
      }
    ],
    connections: {
      "When clicking \"Test workflow\"": {
        main: [
          [
            {
              node: `${item.title} Logic`,
              type: "main",
              index: 0
            }
          ]
        ]
      }
    },
    active: false,
    settings: {
      saveManualExecutions: true,
      timezone: "America/Mexico_City"
    },
    tags: [
      {
        name: `rp9-marketplace`,
        id: "marketplace"
      },
      {
        name: item.category_key || 'general',
        id: item.category_key || 'general'
      }
    ]
  }

  // Personalizar según settings del usuario
  if (settings.custom_variables) {
    baseWorkflow.settings.variables = settings.custom_variables
  }

  return baseWorkflow
}

// Sanitizar workflow para el tenant específico
function sanitizeWorkflowForTenant(workflowJson: any, tenantId: string, settings: any = {}) {
  const sanitized = { ...workflowJson }

  // Añadir metadata del tenant
  sanitized.tags = sanitized.tags || []
  sanitized.tags.push({
    name: `tenant-${tenantId.substring(0, 8)}`,
    id: `tenant-${tenantId.substring(0, 8)}`
  })

  // Sanitizar URLs y secretos
  if (sanitized.nodes) {
    sanitized.nodes = sanitized.nodes.map((node: any) => {
      // Remover cualquier URL hardcodeada o secrets
      if (node.parameters) {
        // Reemplazar placeholders con configuración del tenant
        const nodeParamsStr = JSON.stringify(node.parameters)
        const sanitizedParams = nodeParamsStr
          .replace(/{{TENANT_ID}}/g, tenantId)
          .replace(/{{WEBHOOK_URL}}/g, `${process.env.FRONTEND_URL}/api/webhooks/${tenantId}`)
          .replace(/{{API_BASE_URL}}/g, process.env.FRONTEND_URL!)

        node.parameters = JSON.parse(sanitizedParams)
      }

      return node
    })
  }

  return sanitized
}

// Instalar workflow en n8n via API
async function installWorkflowToN8n(workflowJson: any, workflowName: string, tenantId: string) {
  const n8nApiUrl = `${N8N_BASE_URL}/api/v1/workflows`

  const response = await fetch(n8nApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
      'User-Agent': 'RP9-Marketplace/1.0'
    },
    body: JSON.stringify({
      name: workflowName,
      nodes: workflowJson.nodes,
      connections: workflowJson.connections,
      active: false, // Usuario debe activar manualmente
      settings: workflowJson.settings,
      tags: workflowJson.tags
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`N8N API error: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  
  return {
    workflow_id: result.id,
    name: result.name,
    active: result.active,
    created_at: result.createdAt
  }
}