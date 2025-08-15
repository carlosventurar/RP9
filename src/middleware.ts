import { NextRequest, NextResponse } from 'next/server'
import { i18nConfig, detectLocaleFromDomain, isValidLocale } from '@/lib/i18n/config'
import { createClient } from '@/lib/supabase/middleware-client'

// Middleware for internationalization (Fase 15)
// Implements UTM > IP-geo > Accept-Language > Cookie negotiation
// Supports country aliases (/mx -> /es-MX)

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') ||
    pathname.startsWith('/assets/')
  ) {
    return NextResponse.next()
  }

  // Redirect marketing pages to landing site
  const marketingPages = ['/pricing', '/contacto', '/contact', '/webinars', '/partners', '/lighthouse', '/roi']
  const isMarketingPage = marketingPages.some(page => 
    pathname === page || 
    pathname.includes(page) || 
    pathname.split('/').slice(2).join('/').startsWith(page.slice(1))
  )
  
  if (isMarketingPage) {
    const landingUrl = new URL(pathname, 'https://agentevirtualia.com')
    landingUrl.search = request.nextUrl.search
    return NextResponse.redirect(landingUrl)
  }

  // Check if this is a protected app route
  const isAppRoute = pathname.includes('/app/')
  const response = NextResponse.next()

  if (isAppRoute) {
    // Check authentication for /app/* routes
    const supabase = createClient(request, response)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // User not authenticated, redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Handle country aliases first (/mx -> /es-MX)
  const pathSegment = pathname.split('/')[1]
  const aliasPath = `/${pathSegment}`
  
  if (i18nConfig.countryAliases[aliasPath]) {
    const targetLocale = i18nConfig.countryAliases[aliasPath]
    const newPathname = pathname.replace(aliasPath, `/${targetLocale}`)
    const redirectUrl = new URL(newPathname, request.url)
    redirectUrl.search = request.nextUrl.search
    
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.set('agentevirtualia-locale', targetLocale, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
    return response
  }

  // Check if pathname already has a valid locale
  const pathnameHasLocale = i18nConfig.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (!pathnameHasLocale) {
    let locale = i18nConfig.defaultLocale

    // Get country code for geolocation (available throughout function)
    const countryCode = request.headers.get('x-country') || 
                       request.headers.get('cf-ipcountry') || 
                       request.headers.get('cloudfront-viewer-country')

    // PRIORITY 1: UTM parameter (marketing campaigns)
    const utmLocale = searchParams.get('utm_locale') || searchParams.get('utm_loc')
    if (utmLocale && isValidLocale(utmLocale)) {
      locale = utmLocale
    } else if (countryCode) {
      // PRIORITY 2: IP Geolocation (from Netlify/Cloudflare headers)
      // Map country codes to locales
      const countryToLocale = {
        'MX': 'es-MX',
        'CO': 'es-CO', 
        'CL': 'es-CL',
        'PE': 'es-PE',
        'AR': 'es-AR',
        'DO': 'es-DO',
        'US': 'en-US'
      }
      
      const geoLocale = countryToLocale[countryCode.toUpperCase()]
      if (geoLocale && isValidLocale(geoLocale)) {
        locale = geoLocale
      }
    } else {
      // PRIORITY 3: Domain-based detection
      const domainLocale = detectLocaleFromDomain(hostname)
      if (domainLocale && isValidLocale(domainLocale)) {
        locale = domainLocale
      } else {
        // PRIORITY 4: Accept-Language header
        const acceptLanguage = request.headers.get('Accept-Language')
        if (acceptLanguage) {
          const browserLocales = acceptLanguage
            .split(',')
            .map(lang => {
              const [code] = lang.trim().split(';')[0].split('-')
              const [, region] = lang.trim().split(';')[0].split('-')
              
              // Map browser locales to our supported locales
              if (code === 'es') {
                if (region) {
                  const candidate = `es-${region.toUpperCase()}`
                  if (candidate === 'es-MX' || candidate === 'es-CO' || 
                      candidate === 'es-CL' || candidate === 'es-PE' || 
                      candidate === 'es-AR' || candidate === 'es-DO') {
                    return candidate
                  }
                }
                return 'es-419' // Default Spanish LatAm
              }
              if (code === 'en') {
                return 'en-US'
              }
              return null
            })
            .filter(Boolean) as string[]

          const matchedLocale = browserLocales.find(loc => isValidLocale(loc))
          if (matchedLocale) {
            locale = matchedLocale
          }
        }
      }
    }

    // PRIORITY 5: Saved cookie preference (lower priority than geo/utm)
    const localeCookie = request.cookies.get('agentevirtualia-locale')
    if (!utmLocale && !countryCode && localeCookie?.value && isValidLocale(localeCookie.value)) {
      locale = localeCookie.value
    }

    // Redirect to the detected locale
    const redirectUrl = new URL(`/${locale}${pathname}`, request.url)
    redirectUrl.search = request.nextUrl.search

    const response = NextResponse.redirect(redirectUrl)
    
    // Set/update locale cookie
    response.cookies.set('agentevirtualia-locale', locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })

    return response
  }

  // If pathname has locale, validate it
  const currentLocale = pathname.split('/')[1]
  if (!isValidLocale(currentLocale)) {
    const newPathname = pathname.replace(`/${currentLocale}`, `/${i18nConfig.defaultLocale}`)
    return NextResponse.redirect(new URL(newPathname, request.url))
  }

  // Update cookie if different from current locale
  const localeCookie = request.cookies.get('agentevirtualia-locale')
  if (!localeCookie || localeCookie.value !== currentLocale) {
    const response = NextResponse.next()
    response.cookies.set('agentevirtualia-locale', currentLocale, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all pathnames except for:
    // - API routes
    // - _next (Next.js internals)
    // - Static files (images, fonts, etc.)
    // - Public files
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
}