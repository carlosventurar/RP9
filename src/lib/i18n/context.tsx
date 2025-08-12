'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  i18nConfig, 
  isValidLocale, 
  getCountryConfig, 
  getFormatConfig,
  getLegalConfig,
  getMarketingConfig,
  formatCurrency,
  formatDate as formatDateUtil,
  formatPhoneNumber
} from './config'

interface I18nContextType {
  locale: string
  locales: string[]
  country: string
  countryName: string
  currency: string
  currencySymbol: string
  timezone: string
  formatCurrency: (amount: number) => string
  formatDate: (date: Date) => string
  formatPhoneNumber: (phone: string) => string
  changeLocale: (newLocale: string) => void
  t: (key: string, options?: { fallback?: string } & Record<string, string>) => string
  countryConfig: ReturnType<typeof getCountryConfig>
  formatConfig: ReturnType<typeof getFormatConfig>
  legalConfig: ReturnType<typeof getLegalConfig>
  marketingConfig: ReturnType<typeof getMarketingConfig>
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

// Translation dictionaries (will be loaded dynamically)
const translations: Record<string, Record<string, string>> = {}

// Load translation function
async function loadTranslations(locale: string) {
  if (!translations[locale]) {
    try {
      const response = await fetch(`/api/i18n/translations?locale=${locale}`)
      if (response.ok) {
        translations[locale] = await response.json()
      } else {
        // Fallback to default locale
        console.warn(`Failed to load translations for ${locale}, using fallback`)
        if (locale !== i18nConfig.fallbackLocale) {
          await loadTranslations(i18nConfig.fallbackLocale)
        }
      }
    } catch (error) {
      console.error(`Error loading translations for ${locale}:`, error)
    }
  }
}

interface I18nProviderProps {
  children: React.ReactNode
  initialLocale?: string
  initialTranslations?: Record<string, string>
}

export function I18nProvider({ 
  children, 
  initialLocale,
  initialTranslations = {}
}: I18nProviderProps) {
  const params = useParams()
  const router = useRouter()
  
  const currentLocale = (params?.locale as string) || initialLocale || i18nConfig.defaultLocale
  const [locale, setLocale] = useState(currentLocale)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize translations if provided
  if (initialTranslations && Object.keys(initialTranslations).length > 0) {
    translations[locale] = initialTranslations
  }

  // Load translations when locale changes
  useEffect(() => {
    if (!translations[locale]) {
      setIsLoading(true)
      loadTranslations(locale).finally(() => setIsLoading(false))
    }
  }, [locale])

  // Update locale when route changes
  useEffect(() => {
    if (isValidLocale(currentLocale) && currentLocale !== locale) {
      setLocale(currentLocale)
    }
  }, [currentLocale, locale])

  const countryConfig = getCountryConfig(locale)
  const formatConfig = getFormatConfig(locale)
  const legalConfig = getLegalConfig(locale)
  const marketingConfig = getMarketingConfig(locale)

  const changeLocale = (newLocale: string) => {
    if (isValidLocale(newLocale) && newLocale !== locale) {
      // Update the URL
      const currentPath = window.location.pathname
      const pathWithoutLocale = currentPath.replace(`/${locale}`, '')
      const newPath = `/${newLocale}${pathWithoutLocale}`
      
      // Set cookie
      document.cookie = `rp9-locale=${newLocale}; max-age=${60 * 60 * 24 * 365}; path=/`
      
      // Navigate to new locale
      router.push(newPath)
    }
  }

  const t = (key: string, options: { fallback?: string } & Record<string, string> = {}) => {
    const { fallback, ...params } = options
    const localeTranslations = translations[locale] || translations[i18nConfig.fallbackLocale] || {}
    let translation = localeTranslations[key] || fallback || key

    // Replace parameters in translation
    Object.keys(params).forEach(param => {
      translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), params[param])
    })

    return translation
  }

  const contextValue: I18nContextType = {
    locale,
    locales: i18nConfig.locales,
    country: countryConfig.country,
    countryName: countryConfig.countryName,
    currency: countryConfig.currency,
    currencySymbol: countryConfig.currencySymbol,
    timezone: countryConfig.timezone,
    formatCurrency: (amount: number) => formatCurrency(amount, locale),
    formatDate: (date: Date) => formatDateUtil(date, locale),
    formatPhoneNumber: (phone: string) => formatPhoneNumber(phone, locale),
    changeLocale,
    t,
    countryConfig,
    formatConfig,
    legalConfig,
    marketingConfig
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

// Convenience hooks
export function useTranslation() {
  const { t } = useI18n()
  return { t }
}

export function useLocale() {
  const { locale, changeLocale, locales } = useI18n()
  return { locale, changeLocale, locales }
}

export function useCurrency() {
  const { currency, currencySymbol, formatCurrency } = useI18n()
  return { currency, currencySymbol, formatCurrency }
}

export function useCountry() {
  const { country, countryName, countryConfig } = useI18n()
  return { country, countryName, countryConfig }
}

export function useRegionalConfig() {
  const { countryConfig, formatConfig, legalConfig, marketingConfig } = useI18n()
  return { countryConfig, formatConfig, legalConfig, marketingConfig }
}