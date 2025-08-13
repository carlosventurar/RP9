import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10'
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { 
      item_slug,
      tenant_id,
      user_id,
      purchase_type, // 'one_off' | 'subscription'
      success_url,
      cancel_url,
      coupon_code,
      currency = 'usd'
    } = JSON.parse(event.body || '{}')

    // Validaciones
    if (!item_slug || !tenant_id || !user_id || !purchase_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: item_slug, tenant_id, user_id, purchase_type'
        })
      }
    }

    if (!['one_off', 'subscription'].includes(purchase_type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Invalid purchase_type. Must be one_off or subscription'
        })
      }
    }

    // Obtener detalles del item
    const { data: item, error: itemError } = await supabase
      .from('marketplace_items')
      .select(`
        id,
        slug,
        title,
        short_desc,
        currency,
        one_off_price_cents,
        subscription_price_cents,
        tier,
        revenue_share_bps,
        status,
        images,
        creators!marketplace_items_owner_creator_fkey (
          id,
          stripe_account_id
        )
      `)
      .eq('slug', item_slug)
      .eq('status', 'approved')
      .single()

    if (itemError || !item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Template not found or not available for purchase'
        })
      }
    }

    // Validar que el tipo de compra esté disponible
    const priceToCharge = purchase_type === 'one_off' 
      ? item.one_off_price_cents 
      : item.subscription_price_cents

    if (!priceToCharge || priceToCharge <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: `${purchase_type} purchase not available for this template`
        })
      }
    }

    // Verificar si ya compró este item
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id, status, kind')
      .eq('tenant_id', tenant_id)
      .eq('item_id', item.id)
      .in('status', ['active'])
      .single()

    if (existingPurchase) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: 'You already own this template',
          existing_purchase: {
            id: existingPurchase.id,
            type: existingPurchase.kind
          }
        })
      }
    }

    // Obtener o crear Stripe customer
    let stripeCustomerId = null
    
    // Buscar customer existente por tenant_id
    const { data: existingCustomer } = await supabase
      .from('purchases')
      .select('stripe_customer_id')
      .eq('tenant_id', tenant_id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single()

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id
    } else {
      // Crear nuevo customer en Stripe
      const customer = await stripe.customers.create({
        metadata: {
          tenant_id,
          user_id,
          source: 'rp9_marketplace'
        }
      })
      stripeCustomerId = customer.id
    }

    // Configurar línea de producto para Checkout
    const productName = `${item.title} - ${item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}`
    const productDescription = item.short_desc
    
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let mode: 'payment' | 'subscription' = 'payment'

    if (purchase_type === 'one_off') {
      lineItems = [{
        price_data: {
          currency: item.currency,
          product_data: {
            name: productName,
            description: productDescription,
            images: item.images && item.images.length > 0 ? item.images.slice(0, 8) : [],
            metadata: {
              item_id: item.id,
              item_slug: item.slug,
              tier: item.tier,
              purchase_type: 'one_off'
            }
          },
          unit_amount: priceToCharge
        },
        quantity: 1
      }]
      mode = 'payment'
    } else {
      // Subscription
      lineItems = [{
        price_data: {
          currency: item.currency,
          product_data: {
            name: productName + ' (Mensual)',
            description: productDescription + ' - Suscripción mensual con actualizaciones automáticas',
            images: item.images && item.images.length > 0 ? item.images.slice(0, 8) : [],
            metadata: {
              item_id: item.id,
              item_slug: item.slug,
              tier: item.tier,
              purchase_type: 'subscription'
            }
          },
          unit_amount: priceToCharge,
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }]
      mode = 'subscription'
    }

    // URLs por defecto si no se proporcionan
    const defaultSuccessUrl = `${process.env.FRONTEND_URL}/templates/${item.slug}?purchase=success&session_id={CHECKOUT_SESSION_ID}`
    const defaultCancelUrl = `${process.env.FRONTEND_URL}/templates/${item.slug}?purchase=cancelled`

    // Configuración de Stripe Connect si hay creator
    let applicationFeeAmount = null
    let transferData = null
    
    if (item.creators?.stripe_account_id) {
      // Calcular fee para RP9 (complemento del revenue_share_bps)
      const rpFeePercentage = (10000 - item.revenue_share_bps) / 10000 // Ej: 30% para RP9 si creator tiene 70%
      applicationFeeAmount = Math.round(priceToCharge * rpFeePercentage)
      
      transferData = {
        destination: item.creators.stripe_account_id
      }
    }

    // Crear Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode,
      line_items: lineItems,
      success_url: success_url || defaultSuccessUrl,
      cancel_url: cancel_url || defaultCancelUrl,
      
      // Metadata para webhooks
      metadata: {
        tenant_id,
        user_id,
        item_id: item.id,
        item_slug: item.slug,
        purchase_type,
        creator_id: item.creators?.id || '',
        revenue_share_bps: item.revenue_share_bps.toString()
      },

      // Configurar impuestos automáticos
      automatic_tax: {
        enabled: true
      },

      // Permitir códigos promocionales
      allow_promotion_codes: true,

      // Configuraciones adicionales
      billing_address_collection: 'auto',
      shipping_address_collection: undefined, // No shipping para templates digitales
      
      // Configurar idioma
      locale: 'es'
    }

    // Aplicar Stripe Connect si hay creator
    if (transferData && applicationFeeAmount) {
      if (purchase_type === 'one_off') {
        sessionParams.payment_intent_data = {
          application_fee_amount: applicationFeeAmount,
          transfer_data: transferData
        }
      } else {
        sessionParams.subscription_data = {
          application_fee_percent: ((10000 - item.revenue_share_bps) / 100) // Convertir bps a percentage
        }
      }
    }

    // Aplicar cupón si se proporciona
    if (coupon_code) {
      try {
        const coupon = await stripe.coupons.retrieve(coupon_code)
        if (coupon.valid) {
          sessionParams.discounts = [{ coupon: coupon_code }]
        }
      } catch (couponError) {
        console.warn('Invalid coupon code:', coupon_code)
        // No fallar la compra por cupón inválido, solo ignorar
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // Crear registro preliminar de compra (status pending)
    const fingerprint = generatePurchaseFingerprint(tenant_id, item.id, session.id)
    const licenseKey = await generateLicenseKey(tenant_id, item.id)

    const { error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        tenant_id,
        buyer_user: user_id,
        item_id: item.id,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_intent_id: session.payment_intent as string || session.id,
        stripe_subscription_id: session.subscription as string || null,
        currency: item.currency,
        amount_cents: priceToCharge,
        kind: purchase_type,
        status: 'pending', // Se actualizará a 'active' en webhook
        fingerprint,
        license_key: licenseKey,
        expires_at: purchase_type === 'subscription' ? null : null // Se manejará en webhook
      })

    if (purchaseError) {
      console.error('Failed to create purchase record:', purchaseError)
      // No fallar la compra, el webhook puede crear el registro
    }

    // Incrementar purchase_count (optimista)
    supabase
      .from('marketplace_items')
      .update({ purchase_count: item.purchase_count + 1 })
      .eq('id', item.id)
      .then(() => console.log(`Purchase count incremented for item ${item.id}`))
      .catch(err => console.warn('Failed to increment purchase count:', err))

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          checkout_url: session.url,
          session_id: session.id,
          expires_at: new Date(session.expires_at * 1000).toISOString(),
          item: {
            id: item.id,
            title: item.title,
            price: priceToCharge,
            currency: item.currency,
            purchase_type
          },
          estimated_fees: applicationFeeAmount ? {
            application_fee: applicationFeeAmount,
            creator_receives: priceToCharge - applicationFeeAmount
          } : null
        }
      })
    }

  } catch (error) {
    console.error('Marketplace purchase error:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Payment processing error',
          details: error.message,
          type: error.type
        })
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Helper functions
function generatePurchaseFingerprint(tenantId: string, itemId: string, sessionId: string): string {
  const crypto = require('crypto')
  const data = `${tenantId}-${itemId}-${sessionId}-${Date.now()}`
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)
}

async function generateLicenseKey(tenantId: string, itemId: string): Promise<string> {
  try {
    const { data } = await supabase
      .rpc('generate_license_key', { 
        tenant_uuid: tenantId,
        item_uuid: itemId 
      })
      .single()
    
    return data || `RP9_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  } catch (error) {
    console.warn('Failed to generate license key via DB function, using fallback')
    return `RP9_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  }
}