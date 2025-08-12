import { NextRequest, NextResponse } from 'next/server'
import { i18nConfig, detectLocaleFromDomain, isValidLocale } from '@/lib/i18n/config'

// Middleware for internationalization
// Handles locale detection, routing, and regional redirects

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next()
  }

  // Check if pathname already has a locale
  const pathnameHasLocale = i18nConfig.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (!pathnameHasLocale) {
    // Detect locale from various sources
    let locale = i18nConfig.defaultLocale

    // 1. Try to detect from domain
    const domainLocale = detectLocaleFromDomain(hostname)
    if (domainLocale && isValidLocale(domainLocale)) {
      locale = domainLocale
    }

    // 2. Try to detect from Accept-Language header
    if (locale === i18nConfig.defaultLocale) {
      const acceptLanguage = request.headers.get('Accept-Language')
      if (acceptLanguage) {
        const browserLocales = acceptLanguage
          .split(',')
          .map(lang => {
            const [code] = lang.trim().split(';')
            // Map browser locales to our supported locales
            if (code.startsWith('es')) {
              // Try to match specific Spanish variants
              if (code.includes('-CO')) return 'es-CO'
              if (code.includes('-CL')) return 'es-CL'  
              if (code.includes('-PE')) return 'es-PE'
              if (code.includes('-AR')) return 'es-AR'
              if (code.includes('-DO')) return 'es-DO'
              if (code.includes('-MX')) return 'es-MX'
              // If it's just 'es', use the global Spanish
              if (code === 'es') return 'es'
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

    // 3. Try to detect from cookie
    const localeCookie = request.cookies.get('rp9-locale')
    if (localeCookie?.value && isValidLocale(localeCookie.value)) {
      locale = localeCookie.value
    }

    // 4. Try to detect from query parameter (for testing/debugging)
    const localeParam = request.nextUrl.searchParams.get('locale')
    if (localeParam && isValidLocale(localeParam)) {
      locale = localeParam
    }

    // Redirect to the localized path
    const redirectUrl = new URL(`/${locale}${pathname}`, request.url)
    
    // Preserve query parameters
    redirectUrl.search = request.nextUrl.search

    const response = NextResponse.redirect(redirectUrl)
    
    // Set locale cookie for future visits
    response.cookies.set('rp9-locale', locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })

    return response
  }

  // If pathname has locale, ensure it's valid
  const currentLocale = pathname.split('/')[1]
  if (!isValidLocale(currentLocale)) {
    // Invalid locale, redirect to default
    const newPathname = pathname.replace(`/${currentLocale}`, `/${i18nConfig.defaultLocale}`)
    return NextResponse.redirect(new URL(newPathname, request.url))
  }

  // Update locale cookie if different
  const localeCookie = request.cookies.get('rp9-locale')
  if (!localeCookie || localeCookie.value !== currentLocale) {
    const response = NextResponse.next()
    response.cookies.set('rp9-locale', currentLocale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
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