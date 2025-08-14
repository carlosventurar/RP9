import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface PricebookResponse {
  plans: Record<string, any>
  addons: Record<string, any>
  exchangeRates?: Record<string, number>
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { country, plan, period } = event.queryStringParameters || {}
    
    // If specific lookup requested
    if (country && plan && period) {
      const { data, error } = await supabase
        .rpc('get_price_book_entry', {
          p_country_code: country.toUpperCase(),
          p_plan_id: plan,
          p_period: period
        })

      if (error) {
        console.error('Supabase error:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Database error', details: error.message })
        }
      }

      if (!data || data.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Price not found' })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data[0])
      }
    }

    // Otherwise, return full pricebook
    const [priceBooks, countryConfigs] = await Promise.all([
      supabase.from('price_books').select('*').eq('active', true),
      supabase.from('country_configs').select('*').eq('active', true)
    ])

    if (priceBooks.error) {
      throw new Error(`Price books error: ${priceBooks.error.message}`)
    }

    if (countryConfigs.error) {
      throw new Error(`Country configs error: ${countryConfigs.error.message}`)
    }

    // Transform data into expected format
    const response: PricebookResponse = {
      plans: {},
      addons: {},
      exchangeRates: {
        'USD': 1.0,
        'MXN': 20.0,
        'COP': 4000.0,
        'CLP': 800.0,
        'PEN': 3.8,
        'ARS': 350.0,
        'DOP': 58.0
      }
    }

    // Group by plan and country
    const planMap = new Map<string, any>()
    const addonMap = new Map<string, any>()

    for (const entry of priceBooks.data) {
      const isAddon = entry.plan_id.startsWith('addon_')
      const targetMap = isAddon ? addonMap : planMap
      const planId = isAddon ? entry.plan_id.replace('addon_', '') : entry.plan_id

      if (!targetMap.has(planId)) {
        targetMap.set(planId, {
          name: entry.plan_id.charAt(0).toUpperCase() + entry.plan_id.slice(1),
          description: `${entry.plan_id} plan`,
          pricing: {}
        })
      }

      const plan = targetMap.get(planId)
      if (!plan.pricing[entry.country_code]) {
        plan.pricing[entry.country_code] = {}
      }

      plan.pricing[entry.country_code][entry.period] = {
        stripe_price_id: entry.stripe_price_id,
        currency: entry.currency,
        list_price: entry.list_price,
        psychological_price: entry.psychological_price,
        usd_equivalent: entry.psychological_price / (response.exchangeRates![entry.currency] || 1),
        discount_pct: entry.discount_pct,
        ...(entry.meta && typeof entry.meta === 'object' ? entry.meta : {})
      }
    }

    // Convert maps to objects
    response.plans = Object.fromEntries(planMap)
    response.addons = Object.fromEntries(addonMap)

    // Add country-specific exchange rates if available
    for (const country of countryConfigs.data) {
      if (country.currency && country.currency !== 'USD') {
        // Use hardcoded rates for now - in production this would come from a rates service
        response.exchangeRates![country.currency] = response.exchangeRates![country.currency] || 1.0
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    }

  } catch (error) {
    console.error('Pricebook lookup error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}