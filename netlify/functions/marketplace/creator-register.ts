import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

interface CreatorRegistrationRequest {
  businessName: string
  businessDescription: string
  taxId?: string
  countryCode: string
  payoutMethod: 'stripe' | 'bank' | 'paypal'
  payoutConfig: {
    // Para Stripe
    stripeAccountType?: 'express' | 'standard'
    
    // Para transferencia bancaria
    bankName?: string
    accountNumber?: string
    routingNumber?: string
    accountHolderName?: string
    
    // Para PayPal
    paypalEmail?: string
  }
  tosAccepted: boolean
  marketplaceAgreementAccepted: boolean
}

const validateCreatorData = (data: CreatorRegistrationRequest): string[] => {
  const errors: string[] = []

  if (!data.businessName || data.businessName.length < 2) {
    errors.push('Nombre del negocio debe tener al menos 2 caracteres')
  }

  if (!data.businessDescription || data.businessDescription.length < 10) {
    errors.push('Descripción del negocio debe tener al menos 10 caracteres')
  }

  if (!data.countryCode || !/^[A-Z]{2}$/.test(data.countryCode)) {
    errors.push('Código de país inválido (formato ISO 3166-1 alpha-2)')
  }

  if (!['stripe', 'bank', 'paypal'].includes(data.payoutMethod)) {
    errors.push('Método de pago inválido')
  }

  if (!data.tosAccepted) {
    errors.push('Debe aceptar los términos de servicio')
  }

  if (!data.marketplaceAgreementAccepted) {
    errors.push('Debe aceptar el acuerdo del marketplace')
  }

  // Validaciones específicas por método de pago
  switch (data.payoutMethod) {
    case 'stripe':
      if (!data.payoutConfig.stripeAccountType) {
        errors.push('Tipo de cuenta Stripe requerido')
      }
      break

    case 'bank':
      if (!data.payoutConfig.bankName) {
        errors.push('Nombre del banco requerido')
      }
      if (!data.payoutConfig.accountNumber) {
        errors.push('Número de cuenta requerido')
      }
      if (!data.payoutConfig.accountHolderName) {
        errors.push('Nombre del titular de la cuenta requerido')
      }
      break

    case 'paypal':
      if (!data.payoutConfig.paypalEmail) {
        errors.push('Email de PayPal requerido')
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.payoutConfig.paypalEmail)) {
        errors.push('Email de PayPal inválido')
      }
      break
  }

  return errors
}

const createStripeConnectAccount = async (
  creatorData: CreatorRegistrationRequest,
  userEmail: string
): Promise<{ accountId: string; onboardingUrl?: string }> => {
  try {
    const account = await stripe.accounts.create({
      type: creatorData.payoutConfig.stripeAccountType as 'express' | 'standard',
      country: creatorData.countryCode,
      email: userEmail,
      business_profile: {
        name: creatorData.businessName,
        product_description: creatorData.businessDescription,
        mcc: '5734', // Computer Software Stores MCC
        url: `${process.env.NEXT_PUBLIC_APP_URL}/creators/${creatorData.businessName.toLowerCase().replace(/\s+/g, '-')}`
      },
      capabilities: {
        transfers: { requested: true },
      },
      tos_acceptance: {
        service_agreement: 'recipient',
      },
    })

    let onboardingUrl: string | undefined

    if (creatorData.payoutConfig.stripeAccountType === 'express') {
      // Crear URL de onboarding para Express accounts
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/creator/onboarding/refresh`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/creator/onboarding/success`,
        type: 'account_onboarding',
      })

      onboardingUrl = accountLink.url
    }

    return {
      accountId: account.id,
      onboardingUrl
    }

  } catch (error: any) {
    console.error('Stripe Connect Account Error:', error)
    throw new Error(`Error creando cuenta de Stripe: ${error.message}`)
  }
}

const determineCommissionRate = (countryCode: string): number => {
  // Comisiones diferenciadas por región
  const regionRates: Record<string, number> = {
    // LatAm - comisiones más bajas para incentivar adopción
    'AR': 0.25, // Argentina
    'MX': 0.25, // México
    'CO': 0.25, // Colombia
    'CL': 0.25, // Chile
    'PE': 0.25, // Perú
    'BR': 0.25, // Brasil
    
    // Resto del mundo
    'default': 0.30
  }

  return regionRates[countryCode] || regionRates['default']
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  try {
    // Validar autenticación
    const authHeader = event.headers.authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token de autorización requerido' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token inválido' })
      }
    }

    switch (event.httpMethod) {
      case 'POST':
        // Registrar nuevo creator
        const registrationData: CreatorRegistrationRequest = JSON.parse(event.body || '{}')

        // Validar datos
        const validationErrors = validateCreatorData(registrationData)
        if (validationErrors.length > 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'Datos de registro inválidos',
              details: validationErrors
            })
          }
        }

        // Verificar que el usuario no sea ya un creator
        const { data: existingCreator } = await supabase
          .from('creator_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (existingCreator) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'El usuario ya es un creator registrado' })
          }
        }

        let stripeAccountId: string | undefined
        let onboardingUrl: string | undefined

        // Crear cuenta de Stripe Connect si es necesario
        if (registrationData.payoutMethod === 'stripe') {
          const stripeAccount = await createStripeConnectAccount(registrationData, user.email!)
          stripeAccountId = stripeAccount.accountId
          onboardingUrl = stripeAccount.onboardingUrl
        }

        // Determinar tasa de comisión
        const commissionRate = determineCommissionRate(registrationData.countryCode)

        // Crear perfil de creator
        const { data: creatorProfile, error: createError } = await supabase
          .from('creator_profiles')
          .insert({
            user_id: user.id,
            business_name: registrationData.businessName,
            business_description: registrationData.businessDescription,
            tax_id: registrationData.taxId,
            country_code: registrationData.countryCode,
            payout_method: registrationData.payoutMethod,
            payout_config: {
              ...registrationData.payoutConfig,
              stripeAccountId,
              tosAcceptedAt: new Date().toISOString(),
              marketplaceAgreementAcceptedAt: new Date().toISOString()
            },
            commission_rate: commissionRate,
            verified: false // Requiere verificación manual
          })
          .select()
          .single()

        if (createError) {
          // Si hubo error y se creó cuenta de Stripe, intentar eliminarla
          if (stripeAccountId) {
            try {
              await stripe.accounts.del(stripeAccountId)
            } catch (stripeCleanupError) {
              console.error('Error cleaning up Stripe account:', stripeCleanupError)
            }
          }

          throw new Error(`Error creando perfil de creator: ${createError.message}`)
        }

        // Log de auditoría
        await supabase
          .from('audit_logs')
          .insert({
            tenant_id: null,
            user_id: user.id,
            action: 'creator_registered',
            resource: 'creator_profile',
            resource_id: creatorProfile.id,
            details: {
              businessName: registrationData.businessName,
              payoutMethod: registrationData.payoutMethod,
              countryCode: registrationData.countryCode,
              commissionRate
            },
            ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
            user_agent: event.headers['user-agent']
          })

        return {
          statusCode: 201,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            creator: {
              id: creatorProfile.id,
              businessName: creatorProfile.business_name,
              verified: creatorProfile.verified,
              commissionRate: creatorProfile.commission_rate
            },
            onboardingUrl, // Para Stripe Express accounts
            message: 'Creator registrado exitosamente'
          })
        }

      case 'GET':
        // Obtener información del creator actual
        const { data: creatorInfo, error: getError } = await supabase
          .from('creator_profiles')
          .select(`
            id,
            business_name,
            business_description,
            country_code,
            payout_method,
            commission_rate,
            verified,
            total_earnings_cents,
            total_sales,
            created_at,
            updated_at
          `)
          .eq('user_id', user.id)
          .single()

        if (getError && getError.code !== 'PGRST116') {
          throw new Error(`Error getting creator info: ${getError.message}`)
        }

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creator: creatorInfo || null,
            isCreator: !!creatorInfo
          })
        }

      case 'PUT':
        // Actualizar perfil de creator
        const updateData = JSON.parse(event.body || '{}')

        // Verificar que el usuario es un creator
        const { data: currentCreator, error: getCurrentError } = await supabase
          .from('creator_profiles')
          .select('id, verified')
          .eq('user_id', user.id)
          .single()

        if (getCurrentError || !currentCreator) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Creator no encontrado' })
          }
        }

        // Solo permitir ciertos campos para actualización
        const allowedFields = [
          'business_name',
          'business_description',
          'tax_id',
          'payout_config'
        ]

        const updateFields: Record<string, any> = {}
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            updateFields[field] = updateData[field]
          }
        }

        if (Object.keys(updateFields).length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No hay campos válidos para actualizar' })
          }
        }

        updateFields.updated_at = new Date().toISOString()

        // Si se actualiza información crítica, requerir re-verificación
        const criticalFields = ['business_name', 'tax_id', 'payout_config']
        if (criticalFields.some(field => updateFields[field] !== undefined) && currentCreator.verified) {
          updateFields.verified = false
        }

        const { data: updatedCreator, error: updateError } = await supabase
          .from('creator_profiles')
          .update(updateFields)
          .eq('user_id', user.id)
          .select()
          .single()

        if (updateError) {
          throw new Error(`Error updating creator profile: ${updateError.message}`)
        }

        // Log de auditoría
        await supabase
          .from('audit_logs')
          .insert({
            tenant_id: null,
            user_id: user.id,
            action: 'creator_profile_updated',
            resource: 'creator_profile',
            resource_id: updatedCreator.id,
            details: { updatedFields: Object.keys(updateFields) }
          })

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            creator: updatedCreator,
            message: 'Perfil de creator actualizado exitosamente'
          })
        }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Método no permitido' })
        }
    }

  } catch (error: any) {
    console.error('Creator Registration Error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
}