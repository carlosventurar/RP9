import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { i18nConfig } from '@/lib/i18n/config'

export default getRequestConfig(async () => {
  // Get locale from cookies or default to es-MX (primary market)
  const cookieStore = await cookies()
  let locale = cookieStore.get('rp9-locale')?.value || i18nConfig.defaultLocale
  
  // Ensure locale is valid, fallback if not
  if (!i18nConfig.locales.includes(locale)) {
    locale = i18nConfig.defaultLocale
  }

  try {
    return {
      locale,
      messages: (await import(`./messages/${locale}.json`)).default
    }
  } catch (error) {
    // Fallback to default locale if specific locale file doesn't exist
    console.warn(`Messages file for locale ${locale} not found, falling back to ${i18nConfig.fallbackLocale}`)
    return {
      locale: i18nConfig.fallbackLocale,
      messages: (await import(`./messages/${i18nConfig.fallbackLocale}.json`)).default
    }
  }
})