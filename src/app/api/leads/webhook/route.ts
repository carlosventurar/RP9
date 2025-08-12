// CRM Webhook API Endpoint
// POST /api/leads/webhook - Handles webhooks from CRM systems

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDefaultCRMProvider } from '@/lib/crm/factory'
import { HubSpotWebhookPayload } from '@/lib/crm/types'

// Verify webhook signature
async function verifyWebhookSignature(request: NextRequest, body: string): Promise<boolean> {
  const signature = request.headers.get('x-hubspot-signature') || request.headers.get('x-hubspot-signature-256')
  const webhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET
  
  if (!signature || !webhookSecret) {
    console.warn('Missing signature or webhook secret')
    return false
  }
  
  try {
    const crmProvider = getDefaultCRMProvider()
    if (crmProvider.verifyWebhookSignature) {
      return crmProvider.verifyWebhookSignature(body, signature, webhookSecret)
    }
    return true // Skip verification if not implemented
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return false
  }
}

// Process HubSpot webhook payload
async function processHubSpotWebhook(payload: HubSpotWebhookPayload, supabase: any) {
  const { objectId, subscriptionType, changeFlag, propertyName, propertyValue } = payload
  
  // Find the lead associated with this HubSpot contact/deal
  let lead = null
  
  if (subscriptionType === 'contact.propertyChange' || subscriptionType === 'contact.creation') {
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('hubspot_contact_id', objectId.toString())
      .single()
    
    lead = leadData
  } else if (subscriptionType === 'deal.propertyChange' || subscriptionType === 'deal.creation') {
    // For deals, we might need to look up by company or contact association
    // This is a simplified approach
    console.log('Deal webhook received:', payload)
  }
  
  if (!lead) {
    console.warn('No lead found for webhook:', payload)
    return
  }
  
  // Log the CRM event
  await supabase
    .from('crm_events')
    .insert({
      lead_id: lead.id,
      event_type: `${subscriptionType}_${changeFlag}`,
      event_source: 'hubspot',
      crm_contact_id: subscriptionType.includes('contact') ? objectId.toString() : null,
      crm_deal_id: subscriptionType.includes('deal') ? objectId.toString() : null,
      old_value: null, // HubSpot doesn't provide old values in webhooks
      new_value: propertyValue,
      properties: {
        propertyName,
        subscriptionType,
        changeFlag,
        eventId: payload.eventId
      },
      external_event_id: payload.eventId?.toString(),
      processed: false
    })
  
  // Process specific webhook types
  switch (subscriptionType) {
    case 'contact.propertyChange':
      await processContactPropertyChange(lead, propertyName, propertyValue, supabase)
      break
      
    case 'deal.propertyChange':
      await processDealPropertyChange(objectId, propertyName, propertyValue, supabase)
      break
      
    case 'deal.creation':
      await processDealCreation(objectId, supabase)
      break
      
    default:
      console.log('Unhandled webhook type:', subscriptionType)
  }
}

async function processContactPropertyChange(lead: any, propertyName: string, propertyValue: any, supabase: any) {
  const updates: any = {}
  
  // Map HubSpot property changes to our lead fields
  switch (propertyName) {
    case 'hubspotscore':
      updates.score = Math.max(lead.score || 0, parseInt(propertyValue) || 0)
      break
      
    case 'hs_lead_status':
      updates.status = mapHubSpotStatusToOurStatus(propertyValue)
      break
      
    case 'lifecyclestage':
      updates.stage = mapHubSpotLifecycleToOurStage(propertyValue)
      break
      
    default:
      // For other properties, we might want to store them as metadata
      console.log('Contact property changed:', propertyName, propertyValue)
  }
  
  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString()
    
    await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead.id)
  }
}

async function processDealPropertyChange(dealId: number, propertyName: string, propertyValue: any, supabase: any) {
  // Handle deal property changes
  switch (propertyName) {
    case 'dealstage':
      await handleDealStageChange(dealId, propertyValue, supabase)
      break
      
    case 'amount':
      console.log('Deal amount changed:', dealId, propertyValue)
      break
      
    default:
      console.log('Deal property changed:', propertyName, propertyValue)
  }
}

async function processDealCreation(dealId: number, supabase: any) {
  console.log('New deal created:', dealId)
  
  // You could trigger additional workflows here, such as:
  // - Sending notifications to sales team
  // - Creating follow-up tasks
  // - Updating lead scoring
}

async function handleDealStageChange(dealId: number, newStage: string, supabase: any) {
  console.log('Deal stage changed:', dealId, newStage)
  
  // Handle specific stage transitions
  if (newStage === 'pilot-approved' || newStage === 'closedwon') {
    // Trigger demo tenant creation or other workflows
    await triggerDemoTenant(dealId, supabase)
  }
  
  // Update lead status based on deal stage
  const leadStatus = mapDealStageToLeadStatus(newStage)
  
  // Find leads associated with this deal (simplified)
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .not('hubspot_contact_id', 'is', null)
    // In a real implementation, you'd properly associate deals with leads
  
  // Update lead statuses
  for (const lead of leads || []) {
    await supabase
      .from('leads')
      .update({
        status: leadStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id)
  }
}

async function triggerDemoTenant(dealId: number, supabase: any) {
  // This would trigger the demo tenant creation process
  // For now, we'll just log it
  console.log('Triggering demo tenant creation for deal:', dealId)
  
  // In a real implementation, you might:
  // 1. Call an internal API to create a demo tenant
  // 2. Send credentials to the customer
  // 3. Set up onboarding tasks
}

// Helper functions to map between systems
function mapHubSpotStatusToOurStatus(hubspotStatus: string): string {
  const statusMap: Record<string, string> = {
    'new': 'new',
    'open': 'contacted',
    'qualified': 'qualified',
    'customer': 'customer'
  }
  
  return statusMap[hubspotStatus?.toLowerCase()] || 'new'
}

function mapHubSpotLifecycleToOurStage(lifecycleStage: string): string {
  const stageMap: Record<string, string> = {
    'subscriber': 'lead',
    'lead': 'lead',
    'marketingqualifiedlead': 'mql',
    'salesqualifiedlead': 'sql',
    'opportunity': 'opportunity',
    'customer': 'customer'
  }
  
  return stageMap[lifecycleStage?.toLowerCase()] || 'lead'
}

function mapDealStageToLeadStatus(dealStage: string): string {
  const statusMap: Record<string, string> = {
    'initial-contact': 'contacted',
    'qualified': 'qualified',
    'demo-scheduled': 'demo',
    'demo-completed': 'demo',
    'pilot-discussion': 'pilot',
    'pilot-approved': 'pilot',
    'contract-negotiation': 'pilot',
    'closed-won': 'customer',
    'closed-lost': 'lost'
  }
  
  return statusMap[dealStage?.toLowerCase()] || 'contacted'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    
    // Verify webhook signature
    const isValidSignature = await verifyWebhookSignature(request, body)
    if (!isValidSignature) {
      console.warn('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const payload = JSON.parse(body) as HubSpotWebhookPayload[]
    
    // Initialize Supabase client
    const supabase = createClient()
    
    // Process each webhook payload
    for (const webhookPayload of payload) {
      try {
        await processHubSpotWebhook(webhookPayload, supabase)
      } catch (error) {
        console.error('Error processing webhook payload:', error, webhookPayload)
        
        // Log failed webhook processing
        await supabase
          .from('crm_events')
          .insert({
            event_type: 'webhook_processing_failed',
            event_source: 'hubspot',
            properties: { 
              payload: webhookPayload, 
              error: String(error) 
            },
            external_event_id: webhookPayload.eventId?.toString(),
            processed: false,
            error_message: String(error)
          })
      }
    }
    
    return NextResponse.json({ success: true, processed: payload.length })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook verification (some CRM systems require this)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('hub.challenge')
  
  if (challenge) {
    // HubSpot webhook verification
    return new NextResponse(challenge, { status: 200 })
  }
  
  return NextResponse.json({ message: 'Webhook endpoint active' }, { status: 200 })
}