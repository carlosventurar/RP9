import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
  // Verificar que es una ejecución scheduled
  if (event.httpMethod !== 'POST' && !event.headers['netlify-scheduled']) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    console.log('Starting featured score recalculation...')

    // Obtener todos los items approved para recalcular scores
    const { data: items, error: itemsError } = await supabase
      .from('marketplace_items')
      .select(`
        id,
        slug,
        title,
        install_count,
        purchase_count,
        view_count,
        rating_avg,
        rating_count,
        manual_featured,
        created_at,
        template_installs!template_installs_item_id_fkey (
          executions_30d,
          outcomes_30d,
          success_rate
        )
      `)
      .eq('status', 'approved')

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`)
    }

    if (!items || items.length === 0) {
      console.log('No approved items found')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No items to process',
          updated: 0
        })
      }
    }

    let updatedCount = 0
    const scoreUpdates = []

    for (const item of items) {
      try {
        // Calcular featured score usando múltiples factores
        const score = calculateFeaturedScore(item)
        
        // Solo actualizar si el score cambió significativamente (>0.1)
        const currentScore = item.featured_score || 0
        if (Math.abs(score - currentScore) > 0.1) {
          const { error: updateError } = await supabase
            .from('marketplace_items')
            .update({ 
              featured_score: score,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)

          if (updateError) {
            console.error(`Failed to update score for item ${item.id}:`, updateError)
          } else {
            updatedCount++
            scoreUpdates.push({
              id: item.id,
              title: item.title,
              old_score: currentScore,
              new_score: score,
              change: score - currentScore
            })
          }
        }

      } catch (itemError) {
        console.error(`Error processing item ${item.id}:`, itemError)
      }
    }

    // Obtener top items para logging
    const { data: topItems } = await supabase
      .from('marketplace_items')
      .select('id, title, featured_score, manual_featured')
      .eq('status', 'approved')
      .order('featured_score', { ascending: false })
      .limit(10)

    console.log(`Featured score recalculation completed. Updated: ${updatedCount} items`)

    // Enviar summary a Slack si hay cambios significativos
    if (updatedCount > 0 && process.env.SLACK_WEBHOOK_URL) {
      await sendSlackSummary(updatedCount, scoreUpdates.slice(0, 5), topItems || [])
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Featured scores recalculated successfully',
        stats: {
          total_items: items.length,
          updated_items: updatedCount,
          score_changes: scoreUpdates.length
        },
        top_featured: topItems?.map(item => ({
          title: item.title,
          score: item.featured_score,
          manual: item.manual_featured
        })) || [],
        sample_updates: scoreUpdates.slice(0, 5)
      })
    }

  } catch (error) {
    console.error('Featured score recalculation failed:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Featured score recalculation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Calcular featured score usando algoritmo ponderado
function calculateFeaturedScore(item: any): number {
  // Pesos para cada factor (deben sumar 1.0)
  const weights = {
    adoption: 0.25,        // Instalaciones + uso activo
    engagement: 0.20,      // Vistas + conversión
    quality: 0.20,        // Rating + reviews
    performance: 0.15,     // Success rate + outcomes
    monetization: 0.10,    // Revenue generation
    freshness: 0.10        // Recency boost/decay
  }

  // 1. Adoption Score (0-100)
  const adoptionScore = calculateAdoptionScore(item)
  
  // 2. Engagement Score (0-100)  
  const engagementScore = calculateEngagementScore(item)
  
  // 3. Quality Score (0-100)
  const qualityScore = calculateQualityScore(item)
  
  // 4. Performance Score (0-100)
  const performanceScore = calculatePerformanceScore(item)
  
  // 5. Monetization Score (0-100)
  const monetizationScore = calculateMonetizationScore(item)
  
  // 6. Freshness Score (0-100)
  const freshnessScore = calculateFreshnessScore(item)

  // Combinar scores con pesos
  const finalScore = (
    adoptionScore * weights.adoption +
    engagementScore * weights.engagement +
    qualityScore * weights.quality +
    performanceScore * weights.performance +
    monetizationScore * weights.monetization +
    freshnessScore * weights.freshness
  )

  // Bonus para items con featured manual
  const manualBonus = item.manual_featured ? 15 : 0

  // Score final (0-100)
  return Math.min(100, Math.max(0, finalScore + manualBonus))
}

function calculateAdoptionScore(item: any): number {
  const installs = item.install_count || 0
  const activeInstalls = item.template_installs?.filter((i: any) => 
    i.executions_30d > 0
  ).length || 0

  // Score basado en installs totales (0-50) + installs activos (0-50)
  const installScore = Math.min(50, (installs / 20)) // 20 installs = 50 points
  const activeScore = Math.min(50, (activeInstalls / 10)) // 10 active = 50 points
  
  return installScore + activeScore
}

function calculateEngagementScore(item: any): number {
  const views = item.view_count || 0
  const installs = item.install_count || 0
  
  // Conversion rate: installs/views
  const conversionRate = views > 0 ? (installs / views) : 0
  
  // Score basado en views (0-60) + conversion rate (0-40)
  const viewScore = Math.min(60, (views / 50)) // 50 views = 60 points
  const conversionScore = Math.min(40, conversionRate * 200) // 20% conversion = 40 points
  
  return viewScore + conversionScore
}

function calculateQualityScore(item: any): number {
  const rating = item.rating_avg || 0
  const reviewCount = item.rating_count || 0
  
  // Score basado en rating (0-70) + review count (0-30)
  const ratingScore = (rating / 5) * 70 // 5 stars = 70 points
  const reviewScore = Math.min(30, (reviewCount / 10) * 30) // 10 reviews = 30 points
  
  return ratingScore + reviewScore
}

function calculatePerformanceScore(item: any): number {
  if (!item.template_installs || item.template_installs.length === 0) {
    return 0
  }

  // Promediar métricas de performance de todas las instalaciones
  const totalInstalls = item.template_installs.length
  const avgSuccessRate = item.template_installs.reduce((sum: number, install: any) => 
    sum + (install.success_rate || 0), 0) / totalInstalls

  const avgOutcomes = item.template_installs.reduce((sum: number, install: any) => 
    sum + (install.outcomes_30d || 0), 0) / totalInstalls

  // Score basado en success rate (0-60) + outcomes (0-40)
  const successScore = (avgSuccessRate / 100) * 60 // 100% success = 60 points
  const outcomeScore = Math.min(40, (avgOutcomes / 5) * 40) // 5 outcomes = 40 points
  
  return successScore + outcomeScore
}

function calculateMonetizationScore(item: any): number {
  const purchases = item.purchase_count || 0
  const installs = item.install_count || 0
  
  if (installs === 0) return 0
  
  // Purchase conversion rate
  const purchaseRate = purchases / installs
  
  // Score basado en conversión a compra
  return Math.min(100, purchaseRate * 500) // 20% purchase rate = 100 points
}

function calculateFreshnessScore(item: any): number {
  const createdAt = new Date(item.created_at)
  const now = new Date()
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  
  // Boost para items nuevos (0-30 días), neutral (30-180 días), decay después de 180 días
  if (daysSinceCreated <= 30) {
    return 100 - (daysSinceCreated / 30) * 20 // 100 points → 80 points
  } else if (daysSinceCreated <= 180) {
    return 80 // Neutral
  } else {
    const decay = Math.min(60, (daysSinceCreated - 180) / 10) // -6 points por cada 10 días
    return Math.max(20, 80 - decay) // Mínimo 20 points
  }
}

// Helper: Enviar summary a Slack
async function sendSlackSummary(
  updatedCount: number,
  topChanges: any[],
  topItems: any[]
) {
  try {
    const changesText = topChanges.map(change => 
      `• ${change.title}: ${change.old_score.toFixed(1)} → ${change.new_score.toFixed(1)} (${change.change > 0 ? '+' : ''}${change.change.toFixed(1)})`
    ).join('\n')

    const topText = topItems.slice(0, 5).map((item, index) => 
      `${index + 1}. ${item.title} (${item.score.toFixed(1)}${item.manual ? ' 👑' : ''})`
    ).join('\n')

    const message = {
      text: `📊 RP9 Marketplace Featured Scores Updated`,
      attachments: [{
        color: 'good',
        fields: [
          {
            title: 'Items Updated',
            value: updatedCount.toString(),
            short: true
          },
          {
            title: 'Top Score Changes',
            value: changesText || 'None',
            short: false
          },
          {
            title: 'Current Top 5 Featured',
            value: topText || 'None',
            short: false
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