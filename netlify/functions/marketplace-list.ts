import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event: HandlerEvent) => {
  // Solo GET permitido
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const params = event.queryStringParameters || {}
    
    // Parámetros de filtro
    const {
      q = '', // búsqueda por texto
      category = '', // filtrar por categoría
      tier = '', // low|mid|pro|enterprise
      type = '', // template|pack|solution
      sort = 'featured', // featured|popular|newest|rating|price_asc|price_desc
      page = '1',
      limit = '20',
      featured_only = 'false'
    } = params

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const offset = (pageNum - 1) * limitNum

    // Query base: solo items aprobados
    let query = supabase
      .from('marketplace_items')
      .select(`
        id,
        slug,
        type,
        category_key,
        title,
        short_desc,
        images,
        currency,
        one_off_price_cents,
        subscription_price_cents,
        tier,
        featured_score,
        manual_featured,
        version,
        view_count,
        install_count,
        purchase_count,
        rating_avg,
        rating_count,
        created_at,
        updated_at,
        catalog_categories!marketplace_items_category_key_fkey (
          key,
          name,
          icon
        )
      `)
      .eq('status', 'approved')

    // Filtros
    if (category) {
      query = query.eq('category_key', category)
    }

    if (tier) {
      query = query.eq('tier', tier)
    }

    if (type) {
      query = query.eq('type', type)
    }

    if (featured_only === 'true') {
      query = query.or('manual_featured.eq.true,featured_score.gt.0')
    }

    // Búsqueda full-text en español si hay query
    if (q.trim()) {
      query = query.textSearch('title', q, {
        type: 'websearch',
        config: 'spanish'
      })
    }

    // Ordenamiento
    switch (sort) {
      case 'featured':
        query = query.order('featured_score', { ascending: false })
          .order('manual_featured', { ascending: false })
          .order('rating_avg', { ascending: false })
        break
      case 'popular':
        query = query.order('install_count', { ascending: false })
        break
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      case 'rating':
        query = query.order('rating_avg', { ascending: false })
          .order('rating_count', { ascending: false })
        break
      case 'price_asc':
        // Ordenar por precio, gratis primero
        query = query.order('one_off_price_cents', { 
          ascending: true, 
          nullsFirst: true 
        })
        break
      case 'price_desc':
        query = query.order('one_off_price_cents', { 
          ascending: false,
          nullsLast: true 
        })
        break
      default:
        query = query.order('featured_score', { ascending: false })
    }

    // Paginación
    query = query.range(offset, offset + limitNum - 1)

    const { data: items, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Database query failed',
          details: error.message
        })
      }
    }

    // Incrementar view_count para los items mostrados (async)
    if (items && items.length > 0) {
      const itemIds = items.map(item => item.id)
      supabase
        .rpc('increment_view_counts', { item_ids: itemIds })
        .then(() => console.log('View counts updated'))
        .catch(err => console.error('Failed to update view counts:', err))
    }

    // Obtener estadísticas adicionales
    const [
      { count: totalCount },
      { data: categories },
      { data: featuredItems }
    ] = await Promise.all([
      // Total count para paginación
      supabase
        .from('marketplace_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      
      // Categorías disponibles con conteos
      supabase
        .from('marketplace_items')
        .select('category_key, catalog_categories!marketplace_items_category_key_fkey(name, icon)', { count: 'exact' })
        .eq('status', 'approved')
        .group('category_key'),

      // Items destacados para carrusel
      supabase
        .from('marketplace_items')
        .select('id, slug, title, short_desc, images, featured_score')
        .eq('status', 'approved')
        .or('manual_featured.eq.true,featured_score.gt.5')
        .order('featured_score', { ascending: false })
        .limit(5)
    ])

    // Enriquecer datos con información calculada
    const enrichedItems = items?.map(item => ({
      ...item,
      // Calcular precio display
      price_display: formatPricing(item),
      // Calcular badge de popularidad
      popularity_badge: calculatePopularityBadge(item),
      // Determinar si es featured
      is_featured: item.manual_featured || item.featured_score > 0,
      // URL de imagen principal
      primary_image: item.images && item.images.length > 0 ? item.images[0] : null,
      // Calcular discount si hay tanto one-off como subscription
      has_discount: !!(item.one_off_price_cents && item.subscription_price_cents),
      discount_percentage: calculateBundleDiscount(item)
    }))

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutos cache
      },
      body: JSON.stringify({
        success: true,
        data: {
          items: enrichedItems,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount || 0,
            pages: Math.ceil((totalCount || 0) / limitNum),
            has_next: (pageNum * limitNum) < (totalCount || 0),
            has_prev: pageNum > 1
          },
          filters: {
            categories: categories?.map((cat: any) => ({
              key: cat.category_key,
              name: cat.catalog_categories.name,
              icon: cat.catalog_categories.icon,
              count: cat.count
            })) || [],
            tiers: ['low', 'mid', 'pro', 'enterprise'],
            types: ['template', 'pack', 'solution']
          },
          featured: featuredItems || [],
          query_info: {
            search_term: q,
            category_filter: category,
            tier_filter: tier,
            sort_by: sort,
            featured_only: featured_only === 'true'
          }
        }
      })
    }

  } catch (error) {
    console.error('Marketplace list error:', error)
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

// Helper function: formatear pricing
function formatPricing(item: any): string {
  const { one_off_price_cents, subscription_price_cents, currency } = item
  
  if (!one_off_price_cents && !subscription_price_cents) {
    return 'Free'
  }

  const formatPrice = (cents: number) => {
    const symbol = currency === 'usd' ? '$' : currency.toUpperCase() + ' '
    return `${symbol}${(cents / 100).toFixed(2)}`
  }

  if (one_off_price_cents && subscription_price_cents) {
    return `${formatPrice(one_off_price_cents)} or ${formatPrice(subscription_price_cents)}/mo`
  } else if (one_off_price_cents) {
    return formatPrice(one_off_price_cents)
  } else if (subscription_price_cents) {
    return `${formatPrice(subscription_price_cents)}/mo`
  }

  return 'Free'
}

// Helper function: calcular badge de popularidad
function calculatePopularityBadge(item: any): string | null {
  const { install_count, rating_avg, rating_count, created_at } = item
  
  // Nuevo (menos de 30 días)
  const isNew = new Date(created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  if (isNew && install_count < 100) {
    return 'New'
  }

  // Popular (muchas instalaciones)
  if (install_count > 500) {
    return 'Popular'
  }

  // Highly Rated (rating alto con suficientes reviews)
  if (rating_avg >= 4.5 && rating_count >= 10) {
    return 'Highly Rated'
  }

  // Trending (instalaciones recientes altas)
  if (install_count > 50 && install_count < 500) {
    return 'Trending'
  }

  return null
}

// Helper function: calcular descuento bundle
function calculateBundleDiscount(item: any): number | null {
  const { one_off_price_cents, subscription_price_cents } = item
  
  if (!one_off_price_cents || !subscription_price_cents) {
    return null
  }

  // Calcular ahorro si usas suscripción vs one-off
  // Asumiendo que si tienes ambos, la suscripción anual sale mejor
  const annualSubscription = subscription_price_cents * 12
  
  if (annualSubscription < one_off_price_cents) {
    const savings = one_off_price_cents - annualSubscription
    return Math.round((savings / one_off_price_cents) * 100)
  }

  return null
}

// SQL Function helper (crear en migración): 
/* 
create or replace function increment_view_counts(item_ids uuid[])
returns void as $$
begin
  update marketplace_items 
  set view_count = view_count + 1 
  where id = any(item_ids);
end;
$$ language plpgsql;
*/