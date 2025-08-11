import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { N8nClient, createN8nClient } from '../../src/lib/n8n'
import { sanitizeTemplate, generateInstallationInstructions } from '../../src/lib/template-sanitizer'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Validate authentication
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization required' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      }
    }

    // Get tenant for user
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Tenant not found' })
      }
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}')
    const { templateId, customName, skipSanitization = false } = body

    if (!templateId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Template ID is required' })
      }
    }

    // Get template from database
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single()

    if (templateError || !template) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Template not found' })
      }
    }

    // Check if template is paid and user has access
    if (template.price > 0) {
      const accessStatus = await checkTemplateAccess(tenant.id, templateId)
      if (!accessStatus.hasAccess) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            error: accessStatus.reason,
            price: template.price,
            purchase_url: `/api/template-purchase`,
            template_info: {
              id: template.id,
              name: template.name,
              price: template.price,
              category: template.category
            }
          })
        }
      }
    }

    // Install template
    const installationResult = await installTemplate(
      tenant,
      template,
      customName,
      skipSanitization
    )

    // Record installation
    await recordInstallation(tenant.id, templateId, installationResult.workflowId)

    // Update install count
    await supabase
      .from('templates')
      .update({ 
        install_count: template.install_count + 1 
      })
      .eq('id', templateId)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: installationResult
      })
    }

  } catch (error) {
    console.error('Template installation error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Installation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Install template workflow into tenant's n8n instance
 */
async function installTemplate(
  tenant: any,
  template: any,
  customName?: string,
  skipSanitization = false
) {
  try {
    // Create n8n client for tenant
    const n8nClient = await createN8nClient(tenant.id)

    // Get the workflow JSON
    let workflowJson = template.workflow_json

    // Sanitize the workflow (remove credentials, sensitive data)
    let sanitizationResult = null
    if (!skipSanitization) {
      sanitizationResult = sanitizeTemplate(workflowJson)
      workflowJson = sanitizationResult.sanitizedWorkflow
    }

    // Prepare workflow for installation
    const workflowName = customName || `${template.name} (Template)`
    const workflow = {
      name: workflowName,
      nodes: workflowJson.nodes || [],
      connections: workflowJson.connections || {},
      active: false, // Start inactive for safety
      settings: {
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        saveExecutionProgress: false,
        ...workflowJson.settings
      },
      tags: [
        'template',
        `template-${template.category}`,
        ...(workflowJson.tags || [])
      ]
    }

    // Check if workflow with same name already exists
    const existingWorkflows = await n8nClient.getWorkflows()
    const existingWorkflow = existingWorkflows.find(w => w.name === workflowName)

    let installedWorkflow
    if (existingWorkflow) {
      // Update existing workflow
      console.log(`Updating existing workflow: ${workflowName}`)
      installedWorkflow = await n8nClient.updateWorkflow(existingWorkflow.id!, workflow)
    } else {
      // Create new workflow
      console.log(`Creating new workflow: ${workflowName}`)
      installedWorkflow = await n8nClient.createWorkflow(workflow)
    }

    // Generate installation instructions
    const instructions = sanitizationResult ? 
      generateInstallationInstructions(sanitizationResult) : 
      'Template installed successfully. No additional configuration required.'

    return {
      workflowId: installedWorkflow.id,
      workflowName: installedWorkflow.name,
      sanitizationResult,
      instructions,
      requiresConfiguration: sanitizationResult ? (
        sanitizationResult.credentialMappings.length > 0 || 
        sanitizationResult.variableReplacements.length > 0
      ) : false,
      warnings: sanitizationResult?.warnings || []
    }

  } catch (error) {
    console.error('Error installing template:', error)
    throw new Error(`Failed to install template: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if tenant has access to paid template
 */
async function checkTemplateAccess(tenantId: string, templateId: string) {
  try {
    // Get template info including price
    const { data: template } = await supabase
      .from('templates')
      .select('price, is_active')
      .eq('id', templateId)
      .single()

    if (!template || !template.is_active) {
      return { hasAccess: false, reason: 'Template not found or inactive' }
    }

    // Free templates are always accessible
    if (template.price <= 0) {
      return { hasAccess: true, reason: 'Free template' }
    }

    // For paid templates, check if user has purchased it
    const { data: purchase } = await supabase
      .from('template_purchases')
      .select('id, metadata')
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId)
      .single()

    if (!purchase) {
      return { hasAccess: false, reason: 'Template not purchased' }
    }

    // Check if purchase was disputed/revoked
    if (purchase.metadata?.disputed || purchase.metadata?.access_revoked) {
      return { hasAccess: false, reason: 'Template access revoked' }
    }

    return { hasAccess: true, reason: 'Template purchased' }

  } catch (error) {
    console.error('Error checking template access:', error)
    return { hasAccess: false, reason: 'Access check failed' }
  }
}

/**
 * Record template installation in database
 */
async function recordInstallation(tenantId: string, templateId: string, workflowId: string) {
  try {
    await supabase
      .from('template_installs')
      .insert({
        tenant_id: tenantId,
        template_id: templateId,
        workflow_id: workflowId,
        workflow_name: null, // Will be updated later if needed
        metadata: {
          installed_at: new Date().toISOString(),
          installation_method: 'template-install-api'
        }
      })

    console.log(`Recorded template installation: ${templateId} -> ${workflowId}`)

  } catch (error) {
    console.error('Error recording installation:', error)
    // Don't throw error here, installation was successful even if recording failed
  }
}

/**
 * Get template installation status for a tenant
 */
export async function getTemplateInstallationStatus(tenantId: string, templateId: string) {
  try {
    const { data: installation, error } = await supabase
      .from('template_installs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId)
      .order('installed_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !installation) {
      return { installed: false }
    }

    return {
      installed: true,
      workflowId: installation.workflow_id,
      installedAt: installation.installed_at,
      metadata: installation.metadata
    }

  } catch (error) {
    console.error('Error checking installation status:', error)
    return { installed: false }
  }
}

/**
 * Validate template workflow JSON
 */
export function validateTemplateWorkflow(workflowJson: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!workflowJson) {
    errors.push('Workflow JSON is required')
    return { valid: false, errors }
  }

  if (!workflowJson.nodes || !Array.isArray(workflowJson.nodes)) {
    errors.push('Workflow must have a nodes array')
  }

  if (workflowJson.nodes.length === 0) {
    errors.push('Workflow must have at least one node')
  }

  // Validate each node
  workflowJson.nodes.forEach((node: any, index: number) => {
    if (!node.name) {
      errors.push(`Node ${index} is missing a name`)
    }
    if (!node.type) {
      errors.push(`Node ${index} is missing a type`)
    }
    if (!node.parameters) {
      errors.push(`Node ${index} is missing parameters`)
    }
  })

  // Validate connections
  if (workflowJson.connections && typeof workflowJson.connections !== 'object') {
    errors.push('Connections must be an object')
  }

  // Check for required trigger node
  const hasTrigger = workflowJson.nodes.some((node: any) => 
    node.type && (
      node.type.includes('trigger') ||
      node.type.includes('webhook') ||
      node.type.includes('manual')
    )
  )

  if (!hasTrigger) {
    errors.push('Workflow must have at least one trigger node')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}