import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { tenantId, userId, taskKey, status, meta } = JSON.parse(event.body || '{}')

    // Validate required fields
    if (!tenantId || !taskKey || !status) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: tenantId, taskKey, status' })
      }
    }

    // Validate status
    if (!['pending', 'done', 'error'].includes(status)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid status. Must be: pending, done, or error' })
      }
    }

    // Check if progress entry already exists
    const { data: existing } = await supabase
      .from('onboarding_progress')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('task_key', taskKey)
      .single()

    let result
    if (existing) {
      // Update existing progress
      result = await supabase
        .from('onboarding_progress')
        .update({
          status,
          meta: meta || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
    } else {
      // Insert new progress
      result = await supabase
        .from('onboarding_progress')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          task_key: taskKey,
          status,
          meta: meta || {}
        })
        .select()
    }

    if (result.error) {
      console.error('Supabase error:', result.error)
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Database error', details: result.error.message })
      }
    }

    // If task is completed, calculate and update health score
    if (status === 'done') {
      try {
        // Calculate new health score
        const { data: scoreData } = await supabase
          .rpc('calculate_health_score', { p_tenant_id: tenantId })

        if (scoreData) {
          // Save health snapshot
          await supabase
            .from('health_snapshots')
            .insert({
              tenant_id: tenantId,
              score: scoreData.total,
              breakdown: {
                outcome: scoreData.outcome,
                integrations: scoreData.integrations,
                usage: scoreData.usage
              }
            })
        }
      } catch (scoreError) {
        console.warn('Error calculating health score:', scoreError)
        // Don't fail the main operation if health score calculation fails
      }
    }

    // Log to audit trail
    await supabase
      .from('audit_log')
      .insert({
        tenant_id: tenantId,
        actor: userId,
        action: 'onboarding.progress_updated',
        resource: `task/${taskKey}`,
        meta: {
          task_key: taskKey,
          status,
          previous_status: existing ? 'existing' : 'new',
          ...meta
        },
        hash: 'placeholder' // Would implement proper hash generation
      })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        progress: result.data?.[0],
        message: existing ? 'Progress updated' : 'Progress created'
      })
    }

  } catch (error) {
    console.error('Error saving progress:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}