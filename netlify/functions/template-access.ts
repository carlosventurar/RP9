import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (!['GET', 'POST'].includes(event.httpMethod!)) {
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

    if (event.httpMethod === 'GET') {
      // GET /api/template-access?templateId=xxx - Check single template access
      return await handleGetTemplateAccess(event, tenant.id, headers)
    } else if (event.httpMethod === 'POST') {
      // POST /api/template-access - Bulk check multiple templates
      return await handleBulkTemplateAccess(event, tenant.id, headers)
    }

  } catch (error) {
    console.error('Template access API error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Handle single template access check
 */
async function handleGetTemplateAccess(event: HandlerEvent, tenantId: string, headers: any) {
  const templateId = event.queryStringParameters?.templateId

  if (!templateId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Template ID is required' })
    }
  }

  const accessStatus = await checkTemplateAccess(tenantId, templateId)

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: {
        templateId,
        hasAccess: accessStatus.hasAccess,
        reason: accessStatus.reason,
        purchaseInfo: accessStatus.purchaseInfo || null
      }
    })
  }
}

/**
 * Handle bulk template access check
 */
async function handleBulkTemplateAccess(event: HandlerEvent, tenantId: string, headers: any) {
  const body = JSON.parse(event.body || '{}')
  const { templateIds } = body

  if (!templateIds || !Array.isArray(templateIds)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Template IDs array is required' })
    }
  }

  if (templateIds.length > 50) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Maximum 50 template IDs per request' })
    }
  }

  // Check access for all templates
  const accessResults = await Promise.all(
    templateIds.map(async (templateId) => {
      const accessStatus = await checkTemplateAccess(tenantId, templateId)
      return {
        templateId,
        hasAccess: accessStatus.hasAccess,
        reason: accessStatus.reason,
        purchaseInfo: accessStatus.purchaseInfo || null
      }
    })
  )

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: {
        results: accessResults,
        summary: {
          total: accessResults.length,
          hasAccess: accessResults.filter(r => r.hasAccess).length,
          needsPurchase: accessResults.filter(r => !r.hasAccess && r.reason.includes('not purchased')).length,
          notFound: accessResults.filter(r => r.reason.includes('not found')).length
        }
      }
    })
  }
}

/**
 * Core function to check template access
 */
async function checkTemplateAccess(tenantId: string, templateId: string) {
  try {
    // Get template info including price
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('id, name, price, category, is_active')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return {
        hasAccess: false,
        reason: 'Template not found',
        purchaseInfo: null
      }
    }

    if (!template.is_active) {
      return {
        hasAccess: false,
        reason: 'Template no longer available',
        purchaseInfo: null
      }
    }

    // Free templates are always accessible
    if (template.price <= 0) {
      return {
        hasAccess: true,
        reason: 'Free template',
        purchaseInfo: {
          isFree: true,
          price: 0
        }
      }
    }

    // Check if user has purchased the template
    const { data: purchase, error: purchaseError } = await supabase
      .from('template_purchases')
      .select(`
        id,
        amount_paid,
        purchased_at,
        stripe_payment_intent_id,
        metadata
      `)
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId)
      .single()

    if (purchaseError || !purchase) {
      return {
        hasAccess: false,
        reason: 'Template not purchased',
        purchaseInfo: {
          isFree: false,
          price: template.price,
          needsPurchase: true,
          purchaseUrl: `/api/template-purchase?templateId=${templateId}`
        }
      }
    }

    // Check if purchase was disputed/revoked
    if (purchase.metadata?.disputed || purchase.metadata?.access_revoked) {
      return {
        hasAccess: false,
        reason: 'Template access revoked',
        purchaseInfo: {
          isFree: false,
          price: template.price,
          previousPurchase: {
            purchasedAt: purchase.purchased_at,
            amountPaid: purchase.amount_paid,
            status: 'revoked'
          }
        }
      }
    }

    // User has valid access
    return {
      hasAccess: true,
      reason: 'Template purchased',
      purchaseInfo: {
        isFree: false,
        price: template.price,
        purchasedAt: purchase.purchased_at,
        amountPaid: purchase.amount_paid,
        stripePaymentIntentId: purchase.stripe_payment_intent_id
      }
    }

  } catch (error) {
    console.error('Error checking template access:', error)
    return {
      hasAccess: false,
      reason: 'Access check failed',
      purchaseInfo: null
    }
  }
}

/**
 * Get user's template purchase history
 */
export async function getUserPurchaseHistory(tenantId: string) {
  try {
    const { data: purchases, error } = await supabase
      .from('template_purchases')
      .select(`
        id,
        amount_paid,
        purchased_at,
        stripe_payment_intent_id,
        metadata,
        templates (
          id,
          name,
          category,
          difficulty,
          icon_url,
          tags
        )
      `)
      .eq('tenant_id', tenantId)
      .order('purchased_at', { ascending: false })

    if (error) {
      throw error
    }

    return {
      purchases: purchases || [],
      summary: {
        totalPurchases: purchases?.length || 0,
        totalSpent: purchases?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0,
        categoriesOwned: [...new Set(purchases?.map(p => p.templates?.category).filter(Boolean))] || []
      }
    }

  } catch (error) {
    console.error('Error getting purchase history:', error)
    return {
      purchases: [],
      summary: {
        totalPurchases: 0,
        totalSpent: 0,
        categoriesOwned: []
      }
    }
  }
}