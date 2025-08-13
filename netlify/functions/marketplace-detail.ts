import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { verifySignature } from '../lib/security/hmac'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const params = event.queryStringParameters || {}
    const { slug, tenant_id, generate_preview_token = 'false' } = params

    if (!slug) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required parameter: slug'
        })
      }
    }

    // Obtener detalles completos del item
    const { data: item, error: itemError } = await supabase
      .from('marketplace_items')
      .select(`
        id,
        slug,
        type,
        category_key,
        title,
        short_desc,
        long_desc,
        images,
        demo_url,
        documentation_url,
        currency,
        one_off_price_cents,
        subscription_price_cents,
        tier,
        revenue_share_bps,
        status,
        featured_score,
        manual_featured,
        version,
        changelog,
        view_count,
        install_count,
        purchase_count,
        rating_avg,
        rating_count,
        metadata,
        requirements,
        tags,
        created_at,
        updated_at,
        catalog_categories!marketplace_items_category_key_fkey (
          key,
          name,
          description,
          icon
        ),
        creators!marketplace_items_owner_creator_fkey (
          id,
          display_name,
          country,
          status
        )
      `)
      .eq('slug', slug)
      .eq('status', 'approved')
      .single()

    if (itemError || !item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Template not found or not approved'
        })
      }
    }

    // Obtener versiones del item (últimas 5)
    const { data: versions } = await supabase
      .from('item_versions')
      .select(`
        id,
        version,
        changelog,
        json_url,
        json_size_bytes,
        passed_lint,
        security_scan_passed,
        created_at
      `)
      .eq('item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Obtener reviews recientes (últimas 10)
    const { data: reviews } = await supabase
      .from('item_reviews')
      .select(`
        id,
        rating,
        title,
        comment,
        pros,
        cons,
        is_verified,
        helpful_count,
        unhelpful_count,
        created_at
      `)
      .eq('item_id', item.id)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10)

    // Obtener estadísticas de adopción del item
    const { data: adoptionStats } = await supabase
      .from('v_adoption_score')
      .select('*')
      .eq('item_id', item.id)
      .single()

    // Obtener items relacionados (misma categoría, excluyendo el actual)
    const { data: relatedItems } = await supabase
      .from('marketplace_items')
      .select(`
        id,
        slug,
        title,
        short_desc,
        images,
        currency,
        one_off_price_cents,
        subscription_price_cents,
        rating_avg,
        install_count
      `)
      .eq('category_key', item.category_key)
      .eq('status', 'approved')
      .neq('id', item.id)
      .order('featured_score', { ascending: false })
      .limit(4)

    // Generar preview token si se solicita y hay tenant_id
    let previewToken = null
    if (generate_preview_token === 'true' && tenant_id) {
      try {
        const { data: existingToken } = await supabase
          .from('preview_tokens')
          .select('*')
          .eq('tenant_id', tenant_id)
          .eq('item_id', item.id)
          .gte('expires_at', new Date().toISOString())
          .single()

        if (existingToken && existingToken.remaining > 0) {
          // Usar token existente
          previewToken = {
            id: existingToken.id,
            remaining: existingToken.remaining,
            expires_at: existingToken.expires_at,
            daily_limit: existingToken.daily_limit
          }
        } else {
          // Crear nuevo token
          const { data: newToken, error: tokenError } = await supabase
            .from('preview_tokens')
            .insert({
              tenant_id,
              item_id: item.id,
              remaining: parseInt(process.env.FREE_PREVIEW_EXECUTIONS || '5'),
              daily_limit: parseInt(process.env.FREE_PREVIEW_EXECUTIONS || '5'),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single()

          if (!tokenError && newToken) {
            previewToken = {
              id: newToken.id,
              remaining: newToken.remaining,
              expires_at: newToken.expires_at,
              daily_limit: newToken.daily_limit
            }
          }
        }
      } catch (tokenError) {
        console.warn('Failed to generate preview token:', tokenError)
        // No fallar toda la request por esto
      }
    }

    // Verificar si el tenant ya compró el item (si se proporciona tenant_id)
    let purchaseInfo = null
    if (tenant_id) {
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id, kind, status, license_key, expires_at')
        .eq('tenant_id', tenant_id)
        .eq('item_id', item.id)
        .eq('status', 'active')
        .single()

      if (purchase) {
        purchaseInfo = {
          purchased: true,
          purchase_type: purchase.kind,
          license_key: purchase.license_key,
          expires_at: purchase.expires_at
        }
      }
    }

    // Verificar si el tenant ya instaló el item
    let installInfo = null
    if (tenant_id) {
      const { data: install } = await supabase
        .from('template_installs')
        .select(`
          id,
          workflow_id,
          version_installed,
          auto_update_enabled,
          pending_major_update,
          executions_30d,
          outcomes_30d,
          success_rate,
          last_execution_at,
          status
        `)
        .eq('tenant_id', tenant_id)
        .eq('item_id', item.id)
        .single()

      if (install) {
        installInfo = {
          installed: true,
          workflow_id: install.workflow_id,
          version_installed: install.version_installed,
          auto_update_enabled: install.auto_update_enabled,
          has_pending_update: !!install.pending_major_update,
          pending_update_version: install.pending_major_update,
          performance: {
            executions_30d: install.executions_30d,
            outcomes_30d: install.outcomes_30d,
            success_rate: install.success_rate,
            last_execution_at: install.last_execution_at
          },
          status: install.status
        }
      }
    }

    // Incrementar view count (async, no esperar)
    supabase
      .from('marketplace_items')
      .update({ view_count: item.view_count + 1 })
      .eq('id', item.id)
      .then(() => console.log(`View count incremented for item ${item.id}`))
      .catch(err => console.warn('Failed to increment view count:', err))

    // Enriquecer datos con información calculada
    const enrichedItem = {
      ...item,
      // Formatear pricing
      price_display: formatPricing(item),
      is_free: !item.one_off_price_cents && !item.subscription_price_cents,
      has_subscription: !!item.subscription_price_cents,
      has_bundle_discount: !!(item.one_off_price_cents && item.subscription_price_cents),
      
      // Calculaciones de popularidad y ratings
      popularity_score: calculatePopularityScore(item),
      rating_distribution: calculateRatingDistribution(reviews || []),
      
      // Metadata enriquecida
      setup_complexity: item.metadata?.complexity || 'intermediate',
      setup_time_minutes: item.metadata?.setup_time_minutes || 15,
      integrations: item.metadata?.integrations || [],
      
      // Tags como array
      tags_array: Array.isArray(item.tags) ? item.tags : [],
      requirements_array: Array.isArray(item.requirements) ? item.requirements : [],
      
      // Imágenes
      primary_image: item.images && item.images.length > 0 ? item.images[0] : null,
      gallery_images: item.images || [],
      
      // Creator info
      creator: item.creators ? {
        name: item.creators.display_name,
        country: item.creators.country,
        status: item.creators.status
      } : null,
      
      // Category info
      category: item.catalog_categories ? {
        key: item.catalog_categories.key,
        name: item.catalog_categories.name,
        description: item.catalog_categories.description,
        icon: item.catalog_categories.icon
      } : null
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600' // 10 minutos cache
      },
      body: JSON.stringify({
        success: true,
        data: {
          item: enrichedItem,
          versions: versions || [],
          reviews: {
            items: reviews || [],
            summary: {
              total_count: item.rating_count,
              average_rating: item.rating_avg,
              rating_distribution: calculateRatingDistribution(reviews || [])
            }
          },
          adoption: adoptionStats || {
            total_executions_30d: 0,
            total_outcomes_30d: 0,
            install_count: 0,
            adoption_score: 0
          },
          related_items: relatedItems || [],
          preview_token: previewToken,
          purchase_info: purchaseInfo,
          install_info: installInfo,
          tenant_context: tenant_id ? {
            can_preview: !!previewToken && previewToken.remaining > 0,
            already_purchased: !!purchaseInfo,
            already_installed: !!installInfo
          } : null
        }
      })
    }

  } catch (error) {
    console.error('Marketplace detail error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Helper functions
function formatPricing(item: any): string {
  const { one_off_price_cents, subscription_price_cents, currency } = item
  
  if (!one_off_price_cents && !subscription_price_cents) {
    return 'Gratis'
  }

  const formatPrice = (cents: number) => {
    const symbol = currency === 'usd' ? '$' : currency.toUpperCase() + ' '
    return `${symbol}${(cents / 100).toFixed(2)}`
  }

  if (one_off_price_cents && subscription_price_cents) {
    const annual = subscription_price_cents * 12
    const savings = one_off_price_cents > annual ? Math.round(((one_off_price_cents - annual) / one_off_price_cents) * 100) : 0
    
    return savings > 10 
      ? `${formatPrice(subscription_price_cents)}/mes (ahorra ${savings}% anual) o ${formatPrice(one_off_price_cents)} único`
      : `${formatPrice(one_off_price_cents)} único o ${formatPrice(subscription_price_cents)}/mes`
  } else if (one_off_price_cents) {
    return `${formatPrice(one_off_price_cents)} pago único`
  } else if (subscription_price_cents) {
    return `${formatPrice(subscription_price_cents)}/mes`
  }

  return 'Gratis'
}

function calculatePopularityScore(item: any): number {
  const { install_count, rating_avg, rating_count, view_count, created_at } = item
  
  // Factores de popularidad
  const installWeight = 0.4
  const ratingWeight = 0.3
  const viewWeight = 0.2
  const ageWeight = 0.1
  
  // Normalizar valores (0-100)
  const installScore = Math.min(100, (install_count / 10)) // 1000 installs = 100 points
  const ratingScore = rating_count > 0 ? (rating_avg / 5) * 100 : 0
  const viewScore = Math.min(100, (view_count / 50)) // 5000 views = 100 points
  
  // Penalizar items muy nuevos o muy viejos
  const daysSinceCreated = (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24)
  const ageScore = daysSinceCreated < 30 ? 50 : daysSinceCreated > 365 ? 30 : 100
  
  return Math.round(
    installScore * installWeight +
    ratingScore * ratingWeight +
    viewScore * viewWeight +
    ageScore * ageWeight
  )
}

function calculateRatingDistribution(reviews: any[]): { [key: string]: number } {
  const distribution = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
  
  reviews.forEach(review => {
    if (review.rating >= 1 && review.rating <= 5) {
      distribution[review.rating.toString()]++
    }
  })
  
  return distribution
}