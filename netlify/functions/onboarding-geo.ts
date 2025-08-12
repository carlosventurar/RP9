import type { Handler } from '@netlify/functions'

// Country detection based on CloudFlare headers or IP geolocation
export const handler: Handler = async (event) => {
  try {
    // CloudFlare provides country code in CF-IPCountry header
    const cfCountry = event.headers['cf-ipcountry']
    
    // Netlify provides geo info
    const netlifyCountry = event.headers['x-country']
    
    // Default LATAM countries we support
    const supportedCountries = ['MX', 'CO', 'CL', 'AR', 'PE', 'DO', 'CR', 'GT', 'HN', 'SV', 'NI', 'PA', 'UY', 'PY', 'BO', 'EC', 'VE']
    
    // Determine country with fallback logic
    let detectedCountry = cfCountry || netlifyCountry || 'MX'
    
    // Ensure it's uppercase
    detectedCountry = detectedCountry.toUpperCase()
    
    // If not in supported countries, default to MX
    if (!supportedCountries.includes(detectedCountry)) {
      detectedCountry = 'MX'
    }

    // Country-specific metadata
    const countryData: Record<string, any> = {
      MX: {
        name: 'México',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        locale: 'es-MX',
        popular_integrations: ['siigo', 'hubspot', 'wa-cloud'],
        business_hours: '9:00-18:00'
      },
      CO: {
        name: 'Colombia',
        timezone: 'America/Bogota',
        currency: 'COP',
        locale: 'es-CO',
        popular_integrations: ['siigo', 'hubspot', 'belvo'],
        business_hours: '8:00-17:00'
      },
      CL: {
        name: 'Chile',
        timezone: 'America/Santiago',
        currency: 'CLP',
        locale: 'es-CL',
        popular_integrations: ['qbo', 'hubspot', 'belvo'],
        business_hours: '9:00-18:00'
      },
      AR: {
        name: 'Argentina',
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        locale: 'es-AR',
        popular_integrations: ['qbo', 'hubspot', 'belvo'],
        business_hours: '9:00-18:00'
      },
      PE: {
        name: 'Perú',
        timezone: 'America/Lima',
        currency: 'PEN',
        locale: 'es-PE',
        popular_integrations: ['qbo', 'hubspot', 'belvo'],
        business_hours: '9:00-18:00'
      }
    }

    const countryInfo = countryData[detectedCountry] || countryData['MX']

    // Additional context from request
    const userAgent = event.headers['user-agent'] || ''
    const acceptLanguage = event.headers['accept-language'] || ''
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent)
    
    // Extract preferred language
    const preferredLang = acceptLanguage.split(',')[0]?.split('-')[0] || 'es'

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: JSON.stringify({
        country: detectedCountry,
        countryName: countryInfo.name,
        timezone: countryInfo.timezone,
        currency: countryInfo.currency,
        locale: countryInfo.locale,
        popularIntegrations: countryInfo.popular_integrations,
        businessHours: countryInfo.business_hours,
        isMobile,
        preferredLanguage: preferredLang,
        detectionMethod: cfCountry ? 'cloudflare' : netlifyCountry ? 'netlify' : 'default',
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Error in geo detection:', error)
    
    // Return safe defaults on error
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'MX',
        countryName: 'México',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        locale: 'es-MX',
        popularIntegrations: ['siigo', 'hubspot', 'wa-cloud'],
        businessHours: '9:00-18:00',
        error: 'Geo detection failed, using defaults',
        timestamp: new Date().toISOString()
      })
    }
  }
}