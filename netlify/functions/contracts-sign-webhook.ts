import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Webhook payload schema (simulating DocuSign/Zoho)
const webhookSchema = z.object({
  contract_id: z.string(),
  event: z.enum(['sent', 'signed', 'completed', 'declined', 'voided']),
  signer_email: z.string().email(),
  signer_name: z.string(),
  signed_at: z.string().optional(),
  signature_id: z.string().optional(),
  webhook_signature: z.string().optional()
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verify webhook signature (placeholder)
async function verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
  if (!process.env.SIGN_WEBHOOK_SECRET || !signature) {
    return true // Skip verification if not configured
  }
  
  // In production, implement proper HMAC verification
  // const expectedSignature = crypto.createHmac('sha256', process.env.SIGN_WEBHOOK_SECRET)
  //   .update(payload)
  //   .digest('hex')
  // return expectedSignature === signature
  
  return true // Placeholder
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-webhook-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing webhook payload' })
      }
    }

    // Verify webhook signature
    const signature = event.headers['x-webhook-signature'] || ''
    if (!await verifyWebhookSignature(event.body, signature)) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid webhook signature' })
      }
    }

    // Parse and validate webhook data
    const webhookData = JSON.parse(event.body)
    const validation = webhookSchema.safeParse(webhookData)
    
    if (!validation.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid webhook payload',
          details: validation.error.issues
        })
      }
    }

    const { contract_id, event: webhookEvent, signer_email, signer_name, signed_at, signature_id } = validation.data

    // Update contract status based on webhook event
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    switch (webhookEvent) {
      case 'sent':
        updateData.status = 'sent'
        break
      case 'signed':
      case 'completed':
        updateData.status = 'signed'
        updateData.signed_at = signed_at || new Date().toISOString()
        updateData.signed_by_email = signer_email
        updateData.signed_by_name = signer_name
        updateData.signature_request_id = signature_id
        break
      case 'declined':
      case 'voided':
        updateData.status = 'terminated'
        break
    }

    // Update contract in database
    const { data: contract, error: updateError } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('id', contract_id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update contract: ${updateError.message}`)
    }

    // Log webhook event for audit
    console.log(`Contract ${contract_id} ${webhookEvent} by ${signer_email}`)

    // Send notification if contract is signed
    if (webhookEvent === 'signed' || webhookEvent === 'completed') {
      // TODO: Send email notification to account manager
      console.log(`Contract ${contract_id} has been signed and is now active`)
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        contract_id,
        event: webhookEvent,
        updated_status: updateData.status
      })
    }

  } catch (error) {
    console.error('Error processing signing webhook:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

export { webhookSchema, verifyWebhookSignature }