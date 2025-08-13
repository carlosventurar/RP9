// RP9 Scheduled Function - Tenant Limits Enforcement
// CRON: Every hour - Compare usage vs Stripe entitlements and apply limits/alerts

import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ORCHESTRATOR_BASE_URL = process.env.ORCHESTRATOR_BASE_URL || 'https://orchestrator.rp9.io'

export const handler: Handler = async (event) => {
  // Verify this is a scheduled execution
  if (event.httpMethod !== 'POST' && !event.headers['netlify-scheduled']) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  console.log('Starting tenant limits enforcement run...')

  try {
    // Call orchestrator enforcement endpoint through bridge
    const bridgeResponse = await fetch('/.netlify/functions/orch-bridge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'POST',
        endpoint: '/enforcement/run',
        payload: {},
        tenant_id: 'system',
        user_id: 'scheduled-job'
      })
    })

    const bridgeData = await bridgeResponse.json()

    if (!bridgeResponse.ok) {
      throw new Error(`Orchestrator enforcement failed: ${JSON.stringify(bridgeData)}`)
    }

    const enforcementResult = bridgeData.data || {}

    console.log('Enforcement run completed:', {
      tenants_checked: enforcementResult.tenants_checked || 0,
      violations_found: enforcementResult.violations_found || 0,
      actions_taken: enforcementResult.actions_taken || 0
    })

    // Send Slack notification if there were violations
    if (enforcementResult.violations_found > 0 && process.env.SLACK_WEBHOOK_URL) {
      await sendSlackNotification(enforcementResult)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Tenant limits enforcement completed',
        data: {
          tenants_checked: enforcementResult.tenants_checked || 0,
          violations_found: enforcementResult.violations_found || 0,
          actions_taken: enforcementResult.actions_taken || 0,
          executed_at: new Date().toISOString()
        }
      })
    }

  } catch (error) {
    console.error('Tenant limits enforcement failed:', error)

    // Send error notification to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      await sendSlackError(error)
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Tenant limits enforcement failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

// Helper: Send success notification to Slack
async function sendSlackNotification(result: any) {
  try {
    const message = {
      text: `🛡️ RP9 Tenant Limits Enforcement Report`,
      attachments: [{
        color: result.violations_found > 0 ? 'warning' : 'good',
        fields: [
          {
            title: 'Tenants Checked',
            value: result.tenants_checked?.toString() || '0',
            short: true
          },
          {
            title: 'Violations Found',
            value: result.violations_found?.toString() || '0',
            short: true
          },
          {
            title: 'Actions Taken',
            value: result.actions_taken?.toString() || '0',
            short: true
          },
          {
            title: 'Execution Time',
            value: new Date().toISOString(),
            short: true
          }
        ]
      }]
    }

    // Add details about specific actions if available
    if (result.actions && result.actions.length > 0) {
      const actionSummary = result.actions
        .slice(0, 5)
        .map((action: any) => `• ${action.tenant_id.substring(0, 8)}... - ${action.action} (${action.reason})`)
        .join('\n')

      message.attachments[0].fields.push({
        title: 'Recent Actions',
        value: actionSummary,
        short: false
      })
    }

    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

  } catch (error) {
    console.error('Failed to send Slack notification:', error)
  }
}

// Helper: Send error notification to Slack
async function sendSlackError(error: any) {
  try {
    const message = {
      text: `🚨 RP9 Tenant Limits Enforcement Failed`,
      attachments: [{
        color: 'danger',
        fields: [
          {
            title: 'Error',
            value: error instanceof Error ? error.message : 'Unknown error',
            short: false
          },
          {
            title: 'Time',
            value: new Date().toISOString(),
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

  } catch (slackError) {
    console.error('Failed to send Slack error notification:', slackError)
  }
}