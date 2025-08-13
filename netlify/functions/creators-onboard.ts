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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { user_id, action = 'create_account_link', refresh_url, return_url } = 
      event.httpMethod === 'POST' 
        ? JSON.parse(event.body || '{}')
        : event.queryStringParameters || {}

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required parameter: user_id'
        })
      }
    }

    // Verificar que el user existe y obtener creator info
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user_id)
      .single()

    let stripeAccountId = creator?.stripe_account_id

    switch (action) {
      case 'create_account_link':
        return await handleCreateAccountLink(
          creator, 
          stripeAccountId, 
          user_id, 
          refresh_url, 
          return_url,
          headers
        )

      case 'get_account_status':
        return await handleGetAccountStatus(creator, stripeAccountId, headers)

      case 'create_creator_profile':
        return await handleCreateCreatorProfile(user_id, event.body, headers)

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid action. Supported: create_account_link, get_account_status, create_creator_profile'
          })
        }
    }

  } catch (error) {
    console.error('Creator onboard error:', error)
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

// Handler: Crear Account Link para Stripe Connect
async function handleCreateAccountLink(
  creator: any,
  stripeAccountId: string | null,
  userId: string,
  refreshUrl?: string,
  returnUrl?: string,
  headers: any = {}
) {
  try {
    // Si no existe Stripe account, crear uno
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'standard', // Standard Connect para máxima flexibilidad
        country: creator?.country || 'MX', // Default Mexico
        email: creator?.email, 
        metadata: {
          user_id: userId,
          creator_id: creator?.id || '',
          source: 'rp9_marketplace_creator'
        }
      })

      stripeAccountId = account.id

      // Actualizar creator con stripe_account_id
      const { error: updateError } = await supabase
        .from('creators')
        .upsert({
          user_id: userId,
          stripe_account_id: stripeAccountId,
          status: 'pending',
          kyc_status: 'pending',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (updateError) {
        console.error('Failed to update creator with Stripe account:', updateError)
      }
    }

    // URLs por defecto
    const defaultRefreshUrl = `${process.env.FRONTEND_URL}/creator/onboard?refresh=true`
    const defaultReturnUrl = `${process.env.FRONTEND_URL}/creator/dashboard?onboard=complete`

    // Crear Account Link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl || defaultRefreshUrl,
      return_url: returnUrl || defaultReturnUrl,
      type: 'account_onboarding'
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          onboarding_url: accountLink.url,
          stripe_account_id: stripeAccountId,
          expires_at: new Date(accountLink.expires_at * 1000).toISOString(),
          instructions: {
            es: 'Completa tu perfil de Stripe Connect para recibir pagos. Este enlace expira en 24 horas.',
            en: 'Complete your Stripe Connect profile to receive payments. This link expires in 24 hours.'
          }
        }
      })
    }

  } catch (error) {
    console.error('Error creating account link:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Stripe account setup error',
          details: error.message,
          type: error.type
        })
      }
    }

    throw error
  }
}

// Handler: Obtener estado de la cuenta Connect
async function handleGetAccountStatus(creator: any, stripeAccountId: string | null, headers: any = {}) {
  if (!stripeAccountId) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          status: 'not_created',
          message: 'Stripe Connect account not created yet',
          next_action: 'create_account_link'
        }
      })
    }
  }

  try {
    // Obtener detalles de la cuenta de Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId)

    const {
      id,
      details_submitted,
      charges_enabled,
      payouts_enabled,
      requirements,
      country,
      default_currency,
      business_type,
      capabilities
    } = account

    // Determinar estado general
    let status = 'incomplete'
    let message = 'Account setup in progress'
    let next_action = 'complete_onboarding'

    if (details_submitted && charges_enabled && payouts_enabled) {
      status = 'active'
      message = 'Account fully activated and ready to receive payments'
      next_action = null
    } else if (details_submitted && !charges_enabled) {
      status = 'under_review'
      message = 'Account under review by Stripe'
      next_action = 'wait_for_approval'
    } else if (!details_submitted) {
      status = 'incomplete'
      message = 'Please complete your Stripe Connect onboarding'
      next_action = 'complete_onboarding'
    }

    // Actualizar status local si cambió
    if (creator) {
      const newKycStatus = payouts_enabled ? 'verified' : details_submitted ? 'pending' : 'failed'
      const newStatus = (charges_enabled && payouts_enabled) ? 'active' : 'pending'

      await supabase
        .from('creators')
        .update({
          kyc_status: newKycStatus,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', creator.id)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          stripe_account_id: id,
          status,
          message,
          next_action,
          details: {
            details_submitted,
            charges_enabled,
            payouts_enabled,
            country,
            default_currency,
            business_type,
            capabilities,
            requirements: {
              currently_due: requirements?.currently_due || [],
              eventually_due: requirements?.eventually_due || [],
              past_due: requirements?.past_due || [],
              pending_verification: requirements?.pending_verification || []
            }
          },
          revenue_info: creator ? {
            total_earnings_cents: creator.total_earnings_cents,
            payout_schedule: creator.payout_schedule,
            items_published: 0 // TODO: calcular desde marketplace_items
          } : null
        }
      })
    }

  } catch (error) {
    console.error('Error retrieving account status:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to retrieve account status',
          details: error.message
        })
      }
    }

    throw error
  }
}

// Handler: Crear perfil de creator inicial
async function handleCreateCreatorProfile(userId: string, body: string | null, headers: any = {}) {
  if (!body) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Request body required'
      })
    }
  }

  const {
    display_name,
    country = 'MX',
    bio,
    website,
    social_links = {},
    specialties = [],
    payout_schedule = 'monthly'
  } = JSON.parse(body)

  if (!display_name || display_name.length < 2) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'display_name is required and must be at least 2 characters'
      })
    }
  }

  try {
    // Crear o actualizar perfil de creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .upsert({
        user_id: userId,
        display_name: display_name.trim(),
        country,
        payout_schedule,
        status: 'pending',
        kyc_status: 'pending',
        metadata: {
          bio: bio?.trim(),
          website: website?.trim(),
          social_links,
          specialties,
          profile_created_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (creatorError) {
      console.error('Failed to create creator profile:', creatorError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to create creator profile',
          details: creatorError.message
        })
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          creator_id: creator.id,
          display_name: creator.display_name,
          status: creator.status,
          kyc_status: creator.kyc_status,
          next_steps: [
            'Complete Stripe Connect onboarding',
            'Upload your first template',
            'Wait for template approval'
          ]
        }
      })
    }

  } catch (error) {
    console.error('Error creating creator profile:', error)
    throw error
  }
}

// Helper: Validar país soportado
function isValidCountry(country: string): boolean {
  const supportedCountries = [
    'MX', 'CO', 'CL', 'AR', 'PE', 'DO', 'CR', 'GT', 
    'HN', 'SV', 'NI', 'PA', 'UY', 'PY', 'BO', 'EC', 'VE',
    'US', 'CA', 'ES' // Algunos países adicionales para creators internacionales
  ]
  return supportedCountries.includes(country.toUpperCase())
}