import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16'
})

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
    const { templateId, successUrl, cancelUrl } = body

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

    // Check if template is paid
    if (template.price <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'This template is free' })
      }
    }

    // Check if user already purchased this template
    const { data: existingPurchase } = await supabase
      .from('template_purchases')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('template_id', templateId)
      .single()

    if (existingPurchase) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Template already purchased' })
      }
    }

    // Create or get Stripe customer
    let customerId = tenant.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant.name,
        metadata: {
          tenant_id: tenant.id,
          user_id: user.id
        }
      })

      customerId = customer.id

      // Update tenant with Stripe customer ID
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant.id)
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: template.name,
              description: template.description,
              images: template.preview_images?.length > 0 ? template.preview_images : undefined,
              metadata: {
                template_id: templateId,
                category: template.category,
                difficulty: template.difficulty
              }
            },
            unit_amount: Math.round(template.price * 100) // Convert to cents
          },
          quantity: 1
        }
      ],
      mode: 'payment', // One-time payment
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/templates?purchase=success&template=${templateId}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/templates?purchase=cancelled`,
      metadata: {
        tenant_id: tenant.id,
        template_id: templateId,
        user_id: user.id
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_intent_data: {
        metadata: {
          tenant_id: tenant.id,
          template_id: templateId,
          user_id: user.id,
          purchase_type: 'template'
        }
      }
    })

    // Log purchase attempt
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        action: 'template_purchase_initiated',
        resource: 'template',
        resource_id: templateId,
        details: {
          template_name: template.name,
          price: template.price,
          stripe_session_id: session.id,
          timestamp: new Date().toISOString()
        }
      })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          checkout_url: session.url,
          session_id: session.id,
          template: {
            id: template.id,
            name: template.name,
            price: template.price,
            currency: 'USD'
          }
        }
      })
    }

  } catch (error) {
    console.error('Template purchase error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Purchase initiation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Get template purchase status for a user
 */
export async function getTemplatePurchaseStatus(tenantId: string, templateId: string) {
  try {
    const { data: purchase, error } = await supabase
      .from('template_purchases')
      .select(`
        *,
        templates (
          name,
          price
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId)
      .single()

    if (error || !purchase) {
      return { purchased: false }
    }

    return {
      purchased: true,
      purchaseId: purchase.id,
      purchasedAt: purchase.purchased_at,
      amountPaid: purchase.amount_paid,
      stripePaymentIntentId: purchase.stripe_payment_intent_id,
      template: purchase.templates
    }

  } catch (error) {
    console.error('Error checking purchase status:', error)
    return { purchased: false }
  }
}

/**
 * Validate template access for installation
 */
export async function validateTemplateAccess(tenantId: string, templateId: string) {
  try {
    // Get template info
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('price')
      .eq('id', templateId)
      .eq('is_active', true)
      .single()

    if (templateError || !template) {
      return { hasAccess: false, reason: 'Template not found' }
    }

    // Free templates are always accessible
    if (template.price <= 0) {
      return { hasAccess: true, reason: 'Free template' }
    }

    // Check if user has purchased the template
    const { data: purchase, error: purchaseError } = await supabase
      .from('template_purchases')
      .select('id, purchased_at')
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId)
      .single()

    if (purchaseError || !purchase) {
      return { 
        hasAccess: false, 
        reason: 'Template not purchased',
        price: template.price
      }
    }

    return { 
      hasAccess: true, 
      reason: 'Template purchased',
      purchasedAt: purchase.purchased_at
    }

  } catch (error) {
    console.error('Error validating template access:', error)
    return { hasAccess: false, reason: 'Validation error' }
  }
}