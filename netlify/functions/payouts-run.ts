import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10'
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAYOUT_THRESHOLD_USD = parseFloat(process.env.STRIPE_PAYOUT_THRESHOLD_USD || '50')

export const handler: Handler = async (event) => {
  // Verificar que es una ejecución scheduled
  if (event.httpMethod !== 'POST' && !event.headers['netlify-scheduled']) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    console.log('Starting monthly payouts run...')
    
    // Calcular periodo (mes anterior)
    const now = new Date()
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0) // Último día del mes anterior
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1) // Primer día del mes anterior

    console.log(`Processing payouts for period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`)

    // Obtener creators con earnings pendientes que superen el threshold
    const { data: eligibleCreators, error: creatorsError } = await supabase
      .from('creators')
      .select(`
        id,
        stripe_account_id,
        display_name,
        country,
        status,
        creator_earnings!creator_earnings_creator_id_fkey (
          id,
          net_amount_cents,
          currency,
          earned_at,
          paid_out
        )
      `)
      .eq('status', 'active')
      .not('stripe_account_id', 'is', null)

    if (creatorsError) {
      throw new Error(`Failed to fetch eligible creators: ${creatorsError.message}`)
    }

    if (!eligibleCreators || eligibleCreators.length === 0) {
      console.log('No eligible creators found')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No eligible creators for payouts',
          processed: 0
        })
      }
    }

    const payoutResults = []
    let totalProcessed = 0

    for (const creator of eligibleCreators) {
      try {
        // Calcular earnings pendientes para este creator en el periodo
        const unpaidEarnings = creator.creator_earnings.filter((earning: any) => 
          !earning.paid_out && 
          new Date(earning.earned_at) >= periodStart &&
          new Date(earning.earned_at) <= periodEnd
        )

        if (unpaidEarnings.length === 0) {
          console.log(`Creator ${creator.display_name}: No unpaid earnings in period`)
          continue
        }

        // Agrupar por currency
        const earningsByCurrency: { [key: string]: any[] } = {}
        unpaidEarnings.forEach((earning: any) => {
          if (!earningsByCurrency[earning.currency]) {
            earningsByCurrency[earning.currency] = []
          }
          earningsByCurrency[earning.currency].push(earning)
        })

        // Procesar payout por cada currency
        for (const [currency, earnings] of Object.entries(earningsByCurrency)) {
          const totalAmountCents = earnings.reduce((sum: number, earning: any) => 
            sum + earning.net_amount_cents, 0
          )

          // Convertir a USD para threshold check (simplificado)
          const thresholdCents = PAYOUT_THRESHOLD_USD * 100
          
          if (totalAmountCents < thresholdCents) {
            console.log(`Creator ${creator.display_name}: Amount ${totalAmountCents} cents below threshold`)
            continue
          }

          // Crear payout record
          const { data: payoutRecord, error: payoutError } = await supabase
            .from('payouts')
            .insert({
              creator_id: creator.id,
              stripe_account_id: creator.stripe_account_id,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
              gross_amount_cents: totalAmountCents,
              fee_amount_cents: 0, // Ya descontado en earnings
              net_amount_cents: totalAmountCents,
              currency: currency,
              status: 'pending',
              earnings_count: earnings.length
            })
            .select()
            .single()

          if (payoutError) {
            console.error(`Failed to create payout record for creator ${creator.id}:`, payoutError)
            continue
          }

          // Ejecutar transfer via Stripe Connect
          try {
            const transfer = await stripe.transfers.create({
              amount: totalAmountCents,
              currency: currency,
              destination: creator.stripe_account_id,
              description: `RP9 Marketplace Payout - ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`,
              metadata: {
                payout_id: payoutRecord.id,
                creator_id: creator.id,
                period_start: periodStart.toISOString().split('T')[0],
                period_end: periodEnd.toISOString().split('T')[0],
                earnings_count: earnings.length.toString()
              }
            })

            // Actualizar payout con transfer ID
            await supabase
              .from('payouts')
              .update({
                stripe_transfer_id: transfer.id,
                status: 'paid',
                paid_at: new Date().toISOString()
              })
              .eq('id', payoutRecord.id)

            // Marcar earnings como pagados
            const earningIds = earnings.map((e: any) => e.id)
            await supabase
              .from('creator_earnings')
              .update({
                paid_out: true,
                payout_id: payoutRecord.id
              })
              .in('id', earningIds)

            // Generar CSV report
            const csvReport = await generatePayoutCSV(payoutRecord.id, creator, earnings)
            const csvUrl = await uploadCSVReport(csvReport, payoutRecord.id)

            // Actualizar payout con CSV URL
            await supabase
              .from('payouts')
              .update({ csv_report_url: csvUrl })
              .eq('id', payoutRecord.id)

            payoutResults.push({
              creator_id: creator.id,
              creator_name: creator.display_name,
              amount_cents: totalAmountCents,
              currency,
              transfer_id: transfer.id,
              payout_id: payoutRecord.id,
              earnings_count: earnings.length,
              status: 'success'
            })

            totalProcessed++
            console.log(`✅ Payout successful for ${creator.display_name}: ${totalAmountCents} ${currency} cents`)

          } catch (stripeError: any) {
            console.error(`Stripe transfer failed for creator ${creator.id}:`, stripeError)
            
            // Actualizar payout como failed
            await supabase
              .from('payouts')
              .update({
                status: 'failed',
                failure_reason: stripeError.message || 'Transfer failed'
              })
              .eq('id', payoutRecord.id)

            payoutResults.push({
              creator_id: creator.id,
              creator_name: creator.display_name,
              amount_cents: totalAmountCents,
              currency,
              payout_id: payoutRecord.id,
              status: 'failed',
              error: stripeError.message
            })
          }
        }

      } catch (creatorError) {
        console.error(`Error processing creator ${creator.id}:`, creatorError)
        payoutResults.push({
          creator_id: creator.id,
          creator_name: creator.display_name,
          status: 'error',
          error: creatorError instanceof Error ? creatorError.message : 'Unknown error'
        })
      }
    }

    // Enviar resumen vía Slack (opcional)
    if (process.env.SLACK_WEBHOOK_URL && totalProcessed > 0) {
      await sendSlackSummary(payoutResults, periodStart, periodEnd, totalProcessed)
    }

    console.log(`Payouts run completed. Processed: ${totalProcessed}`)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Payouts run completed successfully`,
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString()
        },
        stats: {
          total_processed: totalProcessed,
          eligible_creators: eligibleCreators.length,
          failed_payouts: payoutResults.filter(p => p.status === 'failed').length
        },
        results: payoutResults
      })
    }

  } catch (error) {
    console.error('Payouts run failed:', error)
    
    // Enviar error a Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 RP9 Marketplace Payouts Failed`,
          attachments: [{
            color: 'danger',
            fields: [{
              title: 'Error',
              value: error instanceof Error ? error.message : 'Unknown error',
              short: false
            }]
          }]
        })
      }).catch(err => console.error('Failed to send Slack notification:', err))
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Payouts run failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Helper: Generar CSV report
async function generatePayoutCSV(payoutId: string, creator: any, earnings: any[]): Promise<string> {
  const header = 'Earning ID,Item ID,Purchase ID,Amount (cents),Currency,Earned At,Description\n'
  
  const rows = earnings.map(earning => 
    `${earning.id},"${earning.item_id || 'N/A'}","${earning.purchase_id || 'N/A'}",${earning.net_amount_cents},${earning.currency},"${earning.earned_at}","Template earnings"`
  ).join('\n')

  const summary = `\n\nPayout Summary:\nCreator: ${creator.display_name}\nCountry: ${creator.country}\nTotal Earnings: ${earnings.length}\nTotal Amount: ${earnings.reduce((sum, e) => sum + e.net_amount_cents, 0)} cents\nPayout ID: ${payoutId}\n`

  return header + rows + summary
}

// Helper: Upload CSV to storage
async function uploadCSVReport(csvContent: string, payoutId: string): Promise<string> {
  try {
    const fileName = `payouts/${payoutId}_${Date.now()}.csv`
    
    const { data, error } = await supabase.storage
      .from('reports')
      .upload(fileName, csvContent, {
        contentType: 'text/csv',
        upsert: false
      })

    if (error) {
      console.error('Failed to upload CSV:', error)
      return `fallback_url_${payoutId}.csv`
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('reports')
      .getPublicUrl(fileName)

    return publicUrl.publicUrl

  } catch (error) {
    console.error('CSV upload error:', error)
    return `fallback_url_${payoutId}.csv`
  }
}

// Helper: Enviar resumen a Slack
async function sendSlackSummary(
  results: any[], 
  periodStart: Date, 
  periodEnd: Date, 
  totalProcessed: number
) {
  try {
    const totalAmount = results
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + r.amount_cents, 0)

    const message = {
      text: `💰 RP9 Marketplace Monthly Payouts Completed`,
      attachments: [{
        color: 'good',
        fields: [
          {
            title: 'Period',
            value: `${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`,
            short: true
          },
          {
            title: 'Creators Paid',
            value: totalProcessed.toString(),
            short: true
          },
          {
            title: 'Total Amount',
            value: `$${(totalAmount / 100).toFixed(2)} USD`,
            short: true
          },
          {
            title: 'Failed Payouts',
            value: results.filter(r => r.status === 'failed').length.toString(),
            short: true
          }
        ]
      }]
    }

    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

  } catch (error) {
    console.error('Failed to send Slack summary:', error)
  }
}