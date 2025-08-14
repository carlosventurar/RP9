import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

interface CheckoutRequest {
  planId: string
  period: 'monthly' | 'yearly'
  country?: string
  currencyPreference?: 'LOCAL' | 'USD'
  successUrl?: string
  cancelUrl?: string
  customerEmail?: string
  tenantId?: string
  metadata?: Record<string, string>
  taxId?: string
  businessType?: 'B2C' | 'B2B'
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

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
    const requestData: CheckoutRequest = JSON.parse(event.body || '{}')
    const { 
      planId, 
      period, 
      country, 
      currencyPreference = 'LOCAL',
      successUrl, 
      cancelUrl, 
      customerEmail,
      tenantId,
      metadata = {},
      taxId,
      businessType = 'B2C'
    } = requestData

    // Validate required fields
    if (!planId || !period) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'planId and period are required' }),
      }
    }

    // Detect country from headers if not provided
    let detectedCountry = country
    if (!detectedCountry) {
      const countryFromHeader = event.headers['x-country'] || 
                              event.headers['cf-ipcountry'] || 
                              event.headers['cloudfront-viewer-country']
      detectedCountry = countryFromHeader?.toUpperCase() || 'US'
    }

    // Get price book entry using Supabase function
    const { data: priceData, error: priceError } = await supabase
      .rpc('get_price_book_entry', {
        p_country_code: detectedCountry,
        p_plan_id: planId,
        p_period: period,
        p_currency_preference: currencyPreference === 'USD' ? 'USD' : null
      })

    if (priceError || !priceData || priceData.length === 0) {
      console.error('Price lookup error:', priceError)
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Price not found',
          details: `No pricing found for ${planId}/${period}/${detectedCountry}`
        }),
      }
    }

    const priceInfo = priceData[0]

    // Get country configuration and tax rules
    const { data: countryConfig } = await supabase
      .from('country_configs')
      .select('*')
      .eq('country_code', detectedCountry)
      .single()

    const { data: taxRules } = await supabase
      .from('tax_rules')
      .select('*')
      .eq('country', detectedCountry)
      .single()

    // Configure Stripe session based on tax mode
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [
        {
          price: priceInfo.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.URL}/billing/cancel`,
      metadata: {
        ...metadata,
        planId,
        period,
        country: detectedCountry,
        currency: priceInfo.currency,
        tenantId: tenantId || '',
        businessType
      },
      locale: getStripeLocale(detectedCountry)
    }

    // Add payment methods based on country
    const { data: countryFlags } = await supabase
      .from('country_feature_flags')
      .select('payment_methods')
      .eq('country_code', detectedCountry)
      .single()

    const paymentMethods = countryFlags?.payment_methods || ['card']
    sessionConfig.payment_method_types = paymentMethods.filter(isValidStripePaymentMethod)

    // Configure customer data
    if (customerEmail) {
      sessionConfig.customer_email = customerEmail
    }

    // Configure tax collection based on country rules
    if (taxRules) {
      if (taxRules.mode === 'gross' && businessType === 'B2C') {
        // Prices are tax-inclusive
        sessionConfig.tax_id_collection = {
          enabled: taxRules.required || false
        }
        
        if (taxRules.vat && taxRules.vat > 0) {
          sessionConfig.automatic_tax = { enabled: true }
        }
      } else if (taxRules.mode === 'net' && businessType === 'B2B') {
        // Prices are tax-exclusive, require tax ID for B2B
        sessionConfig.tax_id_collection = {
          enabled: true,
          required: 'if_supported'
        }
        sessionConfig.automatic_tax = { enabled: true }
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig)

    // Log the checkout attempt for analytics
    await supabase
      .from('billing_events')
      .insert({
        event_type: 'checkout_created',
        tenant_id: tenantId,
        country: detectedCountry,
        plan_id: planId,
        period,
        currency: priceInfo.currency,
        amount: priceInfo.psychological_price,
        stripe_session_id: session.id,
        metadata: {
          business_type: businessType,
          currency_preference: currencyPreference,
          payment_methods: paymentMethods
        }
      })
      .select()

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        url: session.url,
        sessionId: session.id,
        priceInfo: {
          currency: priceInfo.currency,
          amount: priceInfo.psychological_price,
          stripePrice: priceInfo.stripe_price_id
        },
        taxMode: taxRules?.mode || 'net',
        paymentMethods: paymentMethods
      }),
    }

  } catch (error) {
    console.error('Enhanced checkout error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create checkout session',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    }
  }
}

// Helper functions
function getStripeLocale(countryCode: string): string {
  const localeMap: Record<string, string> = {
    'MX': 'es-MX',
    'CO': 'es-CO',
    'CL': 'es-CL', 
    'PE': 'es-PE',
    'AR': 'es-AR',
    'DO': 'es-DO',
    'US': 'en-US'
  }
  
  return localeMap[countryCode] || 'en-US'
}

function isValidStripePaymentMethod(method: string): boolean {
  const validMethods = [
    'card', 'acss_debit', 'affirm', 'afterpay_clearpay', 'alipay',
    'au_becs_debit', 'bacs_debit', 'bancontact', 'boleto', 'eps',
    'fpx', 'giropay', 'grabpay', 'ideal', 'klarna', 'konbini',
    'link', 'oxxo', 'p24', 'paynow', 'paypal', 'pix', 'promptpay',
    'sepa_debit', 'sofort', 'us_bank_account', 'wechat_pay'
  ]
  
  return validMethods.includes(method)
}