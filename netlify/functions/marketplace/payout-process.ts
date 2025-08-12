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

interface ProcessPayoutsRequest {
  creatorId?: string // Si se especifica, procesar solo este creator
  periodStart: string // ISO date string
  periodEnd: string // ISO date string
  dryRun?: boolean // Para simular sin ejecutar
}

interface CreatorEarnings {
  creatorId: string
  creatorName: string
  payoutMethod: string
  payoutConfig: any
  totalEarningsCents: number
  commissionDeductedCents: number
  netPayoutCents: number
  salesCount: number
  stripeAccountId?: string
  paypalEmail?: string
  bankInfo?: any
}

const calculateCreatorEarnings = async (
  creatorId: string,
  periodStart: string,
  periodEnd: string
): Promise<CreatorEarnings | null> => {
  // Obtener perfil del creator
  const { data: creator, error: creatorError } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('id', creatorId)
    .single()

  if (creatorError || !creator) {
    throw new Error(`Creator no encontrado: ${creatorId}`)
  }

  // Obtener ventas del período
  const { data: sales, error: salesError } = await supabase
    .from('template_sales')
    .select('price_cents, commission_cents, creator_earnings_cents')
    .eq('creator_id', creatorId)
    .eq('status', 'completed')
    .gte('completed_at', periodStart)
    .lte('completed_at', periodEnd)

  if (salesError) {
    throw new Error(`Error obteniendo ventas: ${salesError.message}`)
  }

  if (!sales || sales.length === 0) {
    return null // No hay ventas en este período
  }

  const totalEarningsCents = sales.reduce((sum, sale) => sum + sale.creator_earnings_cents, 0)
  const commissionDeductedCents = sales.reduce((sum, sale) => sum + sale.commission_cents, 0)

  // Aplicar umbral mínimo de payout
  const minimumPayoutCents = parseInt(process.env.PAYOUT_MINIMUM_CENTS || '5000') // $50 por defecto

  if (totalEarningsCents < minimumPayoutCents) {
    console.log(`Creator ${creatorId} no alcanza el mínimo de payout: ${totalEarningsCents} < ${minimumPayoutCents}`)
    return null
  }

  return {
    creatorId: creator.id,
    creatorName: creator.business_name,
    payoutMethod: creator.payout_method,
    payoutConfig: creator.payout_config,
    totalEarningsCents,
    commissionDeductedCents,
    netPayoutCents: totalEarningsCents, // Ya se descontó la comisión en template_sales
    salesCount: sales.length,
    stripeAccountId: creator.payout_config?.stripeAccountId,
    paypalEmail: creator.payout_config?.paypalEmail,
    bankInfo: creator.payout_config?.bankName ? {
      bankName: creator.payout_config.bankName,
      accountNumber: creator.payout_config.accountNumber,
      accountHolderName: creator.payout_config.accountHolderName
    } : undefined
  }
}

const processStripePayout = async (earnings: CreatorEarnings): Promise<{
  success: boolean
  transferId?: string
  error?: string
}> => {
  try {
    if (!earnings.stripeAccountId) {
      throw new Error('Stripe Account ID no encontrado')
    }

    // Verificar que la cuenta esté habilitada para recibir pagos
    const account = await stripe.accounts.retrieve(earnings.stripeAccountId)
    
    if (!account.charges_enabled || !account.payouts_enabled) {
      throw new Error('Cuenta de Stripe no está habilitada para recibir pagos')
    }

    // Crear transferencia
    const transfer = await stripe.transfers.create({
      amount: earnings.netPayoutCents,
      currency: 'usd',
      destination: earnings.stripeAccountId,
      description: `Payout RP9 - ${earnings.creatorName}`,
      metadata: {
        creator_id: earnings.creatorId,
        sales_count: earnings.salesCount.toString(),
        period: new Date().toISOString()
      }
    })

    return {
      success: true,
      transferId: transfer.id
    }

  } catch (error: any) {
    console.error('Stripe Payout Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

const processPayPalPayout = async (earnings: CreatorEarnings): Promise<{
  success: boolean
  batchId?: string
  error?: string
}> => {
  try {
    // Placeholder para integración con PayPal Payouts API
    // En producción, implementar con PayPal SDK
    
    console.log(`PayPal Payout simulado: ${earnings.paypalEmail} - $${earnings.netPayoutCents / 100}`)
    
    return {
      success: true,
      batchId: `PP_BATCH_${Date.now()}_${earnings.creatorId}`
    }

  } catch (error: any) {
    console.error('PayPal Payout Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

const processBankPayout = async (earnings: CreatorEarnings): Promise<{
  success: boolean
  referenceId?: string
  error?: string
}> => {
  try {
    // Placeholder para transferencia bancaria
    // En producción, integrar con servicio de transferencias bancarias
    
    console.log(`Bank Transfer simulado: ${earnings.bankInfo?.bankName} - $${earnings.netPayoutCents / 100}`)
    
    return {
      success: true,
      referenceId: `BANK_${Date.now()}_${earnings.creatorId}`
    }

  } catch (error: any) {
    console.error('Bank Payout Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

const createPayoutRecord = async (
  earnings: CreatorEarnings,
  periodStart: string,
  periodEnd: string,
  payoutResult: any
): Promise<void> => {
  const { data, error } = await supabase
    .from('creator_payouts')
    .insert({
      creator_id: earnings.creatorId,
      period_start: periodStart.split('T')[0], // Solo fecha
      period_end: periodEnd.split('T')[0],
      total_earnings_cents: earnings.totalEarningsCents,
      commission_deducted_cents: earnings.commissionDeductedCents,
      net_payout_cents: earnings.netPayoutCents,
      stripe_transfer_id: payoutResult.transferId,
      paypal_batch_id: payoutResult.batchId,
      bank_transfer_reference: payoutResult.referenceId,
      status: payoutResult.success ? 'processing' : 'failed',
      failure_reason: payoutResult.error,
      processed_at: new Date().toISOString()
    })

  if (error) {
    throw new Error(`Error creando registro de payout: ${error.message}`)
  }
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    // Validar autenticación (solo admins pueden ejecutar payouts)
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

    // Verificar permisos de admin (implementar lógica según tu sistema de permisos)
    const isAdmin = user.email?.endsWith('@rp9.co') || user.user_metadata?.role === 'admin'
    if (!isAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Solo admins pueden procesar payouts' })
      }
    }

    const { 
      creatorId, 
      periodStart, 
      periodEnd, 
      dryRun = false 
    }: ProcessPayoutsRequest = JSON.parse(event.body || '{}')

    if (!periodStart || !periodEnd) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'periodStart y periodEnd son requeridos' })
      }
    }

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      totalPayoutCents: 0,
      errors: [] as string[],
      details: [] as any[]
    }

    // Obtener lista de creators a procesar
    let creatorsQuery = supabase
      .from('creator_profiles')
      .select('id, business_name')
      .eq('verified', true)

    if (creatorId) {
      creatorsQuery = creatorsQuery.eq('id', creatorId)
    }

    const { data: creators, error: creatorsError } = await creatorsQuery

    if (creatorsError) {
      throw new Error(`Error obteniendo creators: ${creatorsError.message}`)
    }

    if (!creators || creators.length === 0) {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'No hay creators verificados para procesar',
          results
        })
      }
    }

    // Procesar cada creator
    for (const creator of creators) {
      try {
        const earnings = await calculateCreatorEarnings(
          creator.id,
          periodStart,
          periodEnd
        )

        if (!earnings) {
          console.log(`Creator ${creator.business_name} no tiene earnings suficientes`)
          continue
        }

        results.processed++
        results.totalPayoutCents += earnings.netPayoutCents

        let payoutResult: any = { success: false }

        if (!dryRun) {
          // Ejecutar payout según el método
          switch (earnings.payoutMethod) {
            case 'stripe':
              payoutResult = await processStripePayout(earnings)
              break
            case 'paypal':
              payoutResult = await processPayPalPayout(earnings)
              break
            case 'bank':
              payoutResult = await processBankPayout(earnings)
              break
            default:
              payoutResult = {
                success: false,
                error: `Método de payout no soportado: ${earnings.payoutMethod}`
              }
          }

          // Crear registro en la base de datos
          await createPayoutRecord(earnings, periodStart, periodEnd, payoutResult)
        } else {
          payoutResult = { success: true, dryRun: true }
        }

        if (payoutResult.success) {
          results.successful++
        } else {
          results.failed++
          results.errors.push(`${creator.business_name}: ${payoutResult.error}`)
        }

        results.details.push({
          creatorName: earnings.creatorName,
          payoutMethod: earnings.payoutMethod,
          netPayoutCents: earnings.netPayoutCents,
          salesCount: earnings.salesCount,
          success: payoutResult.success,
          error: payoutResult.error,
          transferId: payoutResult.transferId,
          dryRun
        })

      } catch (error: any) {
        results.failed++
        results.errors.push(`${creator.business_name}: ${error.message}`)
        console.error(`Error processing payout for creator ${creator.id}:`, error)
      }
    }

    // Log de auditoría
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: null,
        user_id: user.id,
        action: dryRun ? 'payouts_simulated' : 'payouts_processed',
        resource: 'creator_payouts',
        details: {
          periodStart,
          periodEnd,
          processed: results.processed,
          successful: results.successful,
          failed: results.failed,
          totalPayoutCents: results.totalPayoutCents,
          dryRun
        }
      })

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: dryRun 
          ? 'Simulación de payouts completada' 
          : 'Procesamiento de payouts completado',
        results
      })
    }

  } catch (error: any) {
    console.error('Payout Process Error:', error)
    
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