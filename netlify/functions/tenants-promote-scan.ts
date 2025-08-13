// RP9 Scheduled Function - Tenant Promotion Scanner
// CRON: Every 4 hours - Detect shared tenants that should be promoted to dedicated

import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Promotion thresholds
const PROMOTION_THRESHOLDS = {
  executions_monthly: 5000, // > 50% of Pro plan
  concurrent_executions: 5,
  cpu_usage_avg_percent: 60,
  queue_wait_p95_seconds: 3.0,
  storage_usage_gb: 2.0,
  compliance_required: true // Based on tenant metadata or plan
}

export const handler: Handler = async (event) => {
  // Verify this is a scheduled execution
  if (event.httpMethod !== 'POST' && !event.headers['netlify-scheduled']) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  console.log('Starting tenant promotion scan...')

  try {
    // Get all active shared tenants
    const { data: sharedTenants, error: tenantsError } = await supabase
      .from('tenant_instances')
      .select(`
        tenant_id,
        name,
        subdomain,
        email,
        plan,
        created_at,
        metadata
      `)
      .eq('mode', 'shared')
      .eq('status', 'active')

    if (tenantsError) {
      throw new Error(`Failed to fetch shared tenants: ${tenantsError.message}`)
    }

    if (!sharedTenants || sharedTenants.length === 0) {
      console.log('No shared tenants found')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No shared tenants to scan',
          candidates: 0
        })
      }
    }

    console.log(`Scanning ${sharedTenants.length} shared tenants for promotion`)

    const promotionCandidates = []

    for (const tenant of sharedTenants) {
      try {
        // Get tenant usage metrics
        const metrics = await getTenantMetrics(tenant.tenant_id)
        
        // Check promotion criteria
        const promotionCheck = checkPromotionCriteria(tenant, metrics)
        
        if (promotionCheck.shouldPromote) {
          promotionCandidates.push({
            tenant_id: tenant.tenant_id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            plan: tenant.plan,
            reasons: promotionCheck.reasons,
            priority: promotionCheck.priority,
            metrics: metrics
          })

          console.log(`Promotion candidate found: ${tenant.name} (${tenant.subdomain})`, {
            reasons: promotionCheck.reasons,
            priority: promotionCheck.priority
          })
        }

      } catch (tenantError) {
        console.error(`Failed to check tenant ${tenant.tenant_id}:`, tenantError)
      }
    }

    console.log(`Found ${promotionCandidates.length} promotion candidates`)

    // For high-priority candidates, automatically trigger promotion
    const autoPromotions = []
    const manualReviewRequired = []

    for (const candidate of promotionCandidates) {
      if (candidate.priority === 'high' && shouldAutoPromote(candidate)) {
        try {
          await triggerPromotion(candidate)
          autoPromotions.push(candidate)
        } catch (promotionError) {
          console.error(`Auto-promotion failed for ${candidate.tenant_id}:`, promotionError)
          manualReviewRequired.push({
            ...candidate,
            promotion_error: promotionError instanceof Error ? promotionError.message : 'Unknown error'
          })
        }
      } else {
        manualReviewRequired.push(candidate)
      }
    }

    // Send notifications about candidates
    if (promotionCandidates.length > 0 && process.env.SLACK_WEBHOOK_URL) {
      await sendPromotionNotification(autoPromotions, manualReviewRequired)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Tenant promotion scan completed',
        data: {
          tenants_scanned: sharedTenants.length,
          candidates_found: promotionCandidates.length,
          auto_promoted: autoPromotions.length,
          manual_review_required: manualReviewRequired.length,
          executed_at: new Date().toISOString()
        },
        candidates: promotionCandidates.map(c => ({
          tenant_id: c.tenant_id,
          name: c.name,
          subdomain: c.subdomain,
          priority: c.priority,
          reasons: c.reasons
        }))
      })
    }

  } catch (error) {
    console.error('Tenant promotion scan failed:', error)

    // Send error notification to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      await sendSlackError(error)
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Tenant promotion scan failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

// Get tenant usage metrics (mock for now, would integrate with real metrics)
async function getTenantMetrics(tenantId: string) {
  try {
    // In a real implementation, this would aggregate metrics from:
    // 1. n8n database (executions, workflows)
    // 2. Railway shared instance metrics
    // 3. Queue metrics from Redis
    // 4. Storage usage

    // Mock realistic metrics based on tenant age and plan
    const tenant = await supabase
      .from('tenant_instances')
      .select('created_at, plan')
      .eq('tenant_id', tenantId)
      .single()

    const tenantAge = Date.now() - new Date(tenant.data?.created_at || Date.now()).getTime()
    const ageInDays = tenantAge / (1000 * 60 * 60 * 24)
    
    // Generate usage that grows with tenant age
    const usageMultiplier = Math.min(1.0, ageInDays / 30) // Max usage after 30 days
    const randomFactor = 0.7 + Math.random() * 0.6 // 0.7-1.3x

    return {
      executions_monthly: Math.floor(usageMultiplier * randomFactor * 8000),
      concurrent_executions: Math.floor(usageMultiplier * randomFactor * 8),
      cpu_usage_avg_percent: usageMultiplier * randomFactor * 70,
      queue_wait_p95_seconds: usageMultiplier * randomFactor * 4,
      storage_usage_gb: usageMultiplier * randomFactor * 3,
      success_rate_percent: 95 - (usageMultiplier * 5), // Degrades with usage
      active_workflows: Math.floor(usageMultiplier * randomFactor * 15),
      unique_integrations: Math.floor(usageMultiplier * randomFactor * 8)
    }

  } catch (error) {
    console.error(`Failed to get metrics for tenant ${tenantId}:`, error)
    return {
      executions_monthly: 0,
      concurrent_executions: 0,
      cpu_usage_avg_percent: 0,
      queue_wait_p95_seconds: 0,
      storage_usage_gb: 0,
      success_rate_percent: 100,
      active_workflows: 0,
      unique_integrations: 0
    }
  }
}

// Check if tenant meets promotion criteria
function checkPromotionCriteria(tenant: any, metrics: any) {
  const reasons = []
  let priority = 'low'

  // Performance-based triggers (Trigger A)
  if (metrics.executions_monthly > PROMOTION_THRESHOLDS.executions_monthly) {
    reasons.push(`High execution volume: ${metrics.executions_monthly}/month`)
    priority = 'medium'
  }

  if (metrics.concurrent_executions > PROMOTION_THRESHOLDS.concurrent_executions) {
    reasons.push(`High concurrency: ${metrics.concurrent_executions} simultaneous`)
    priority = 'medium'
  }

  if (metrics.cpu_usage_avg_percent > PROMOTION_THRESHOLDS.cpu_usage_avg_percent) {
    reasons.push(`High CPU usage: ${metrics.cpu_usage_avg_percent.toFixed(1)}% average`)
    priority = 'medium'
  }

  if (metrics.queue_wait_p95_seconds > PROMOTION_THRESHOLDS.queue_wait_p95_seconds) {
    reasons.push(`High queue latency: ${metrics.queue_wait_p95_seconds.toFixed(1)}s p95`)
    priority = 'high' // Performance issue = high priority
  }

  if (metrics.storage_usage_gb > PROMOTION_THRESHOLDS.storage_usage_gb) {
    reasons.push(`High storage usage: ${metrics.storage_usage_gb.toFixed(1)}GB`)
  }

  // Compliance-based triggers (Trigger B)
  if (tenant.plan === 'enterprise') {
    reasons.push('Enterprise plan requires dedicated infrastructure')
    priority = 'high'
  }

  // Check metadata for compliance requirements
  const metadata = tenant.metadata || {}
  if (metadata.compliance_required || metadata.data_residency || metadata.custom_domain) {
    reasons.push('Compliance or customization requirements detected')
    priority = 'high'
  }

  // Business logic triggers
  if (tenant.plan === 'pro' && metrics.active_workflows > 10) {
    reasons.push('Pro plan with high workflow complexity')
    priority = 'medium'
  }

  const shouldPromote = reasons.length >= 2 || priority === 'high'

  return {
    shouldPromote,
    reasons,
    priority,
    score: calculatePromotionScore(metrics, tenant)
  }
}

// Calculate numerical promotion score
function calculatePromotionScore(metrics: any, tenant: any): number {
  let score = 0

  // Performance factors (0-50 points)
  score += Math.min(25, (metrics.executions_monthly / 10000) * 25)
  score += Math.min(10, (metrics.concurrent_executions / 10) * 10)
  score += Math.min(10, (metrics.cpu_usage_avg_percent / 100) * 10)
  score += Math.min(5, (metrics.queue_wait_p95_seconds / 5) * 5)

  // Business factors (0-30 points)
  if (tenant.plan === 'enterprise') score += 20
  else if (tenant.plan === 'pro') score += 10

  const metadata = tenant.metadata || {}
  if (metadata.compliance_required) score += 15
  if (metadata.custom_domain) score += 10
  if (metadata.data_residency) score += 15

  // Growth factors (0-20 points)
  score += Math.min(10, (metrics.active_workflows / 20) * 10)
  score += Math.min(10, (metrics.unique_integrations / 15) * 10)

  return Math.min(100, score)
}

// Check if tenant should be auto-promoted
function shouldAutoPromote(candidate: any): boolean {
  // Auto-promote only for very clear cases
  return (
    candidate.priority === 'high' &&
    candidate.metrics.queue_wait_p95_seconds > 5.0 // Clear performance issue
  ) || (
    candidate.tenant.plan === 'enterprise' &&
    candidate.metrics.executions_monthly > 2000 // Active enterprise customer
  )
}

// Trigger promotion through orchestrator
async function triggerPromotion(candidate: any) {
  const bridgeResponse = await fetch('/.netlify/functions/orch-bridge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'POST',
      endpoint: `/tenants/${candidate.tenant_id}/promote`,
      payload: {
        window: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        ttl_minutes: 10,
        reason: 'Auto-promotion based on usage thresholds',
        priority: candidate.priority,
        detected_triggers: candidate.reasons
      },
      tenant_id: candidate.tenant_id,
      user_id: 'auto-promotion-system'
    })
  })

  if (!bridgeResponse.ok) {
    const error = await bridgeResponse.json()
    throw new Error(`Promotion request failed: ${JSON.stringify(error)}`)
  }

  return await bridgeResponse.json()
}

// Send Slack notification about promotion candidates
async function sendPromotionNotification(autoPromotions: any[], manualReview: any[]) {
  try {
    const totalCandidates = autoPromotions.length + manualReview.length

    const message = {
      text: `🚀 RP9 Tenant Promotion Scan Results`,
      attachments: [{
        color: autoPromotions.length > 0 ? 'warning' : 'good',
        fields: [
          {
            title: 'Total Candidates',
            value: totalCandidates.toString(),
            short: true
          },
          {
            title: 'Auto-Promoted',
            value: autoPromotions.length.toString(),
            short: true
          },
          {
            title: 'Manual Review Required',
            value: manualReview.length.toString(),
            short: true
          }
        ]
      }]
    }

    // Add details about candidates requiring manual review
    if (manualReview.length > 0) {
      const reviewSummary = manualReview
        .slice(0, 3)
        .map(c => `• ${c.name} (${c.subdomain}) - ${c.priority} priority\n  ${c.reasons.slice(0, 2).join(', ')}`)
        .join('\n')

      message.attachments[0].fields.push({
        title: 'Top Manual Review Cases',
        value: reviewSummary,
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
      text: `🚨 RP9 Tenant Promotion Scan Failed`,
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