'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { getCountryConfig } from '@/lib/i18n/config'

interface PriceBookEntry {
  stripe_price_id: string
  currency: string
  list_price: number
  psychological_price: number
  usd_equivalent: number
  discount_pct?: number
  savings_message?: string
}

interface PriceBook {
  plans: {
    [planId: string]: {
      name: string
      description: string
      features: string[]
      pricing: {
        [countryCode: string]: {
          [period: string]: PriceBookEntry
        }
      }
    }
  }
  addons: {
    [addonId: string]: {
      name: string
      description: string
      pricing: {
        [countryCode: string]: Omit<PriceBookEntry, 'discount_pct' | 'savings_message'>
      }
    }
  }
}

export function usePriceBook() {
  const [priceBook, setPriceBook] = useState<PriceBook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const locale = useLocale()
  
  const countryConfig = getCountryConfig(locale)
  const countryCode = countryConfig.country

  useEffect(() => {
    const loadPriceBook = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Try to load from API first (dynamic pricing)
        let response = await fetch('/api/pricebook')
        
        if (!response.ok) {
          // Fallback to static JSON file
          response = await fetch('/config/pricebook.json')
        }
        
        if (!response.ok) {
          throw new Error(`Failed to load price book: ${response.status}`)
        }
        
        const data = await response.json()
        setPriceBook(data)
      } catch (err) {
        console.error('Error loading price book:', err)
        setError(err instanceof Error ? err.message : 'Failed to load pricing')
        
        // Try one more fallback - direct import
        try {
          const fallbackData = await import('../../../config/pricebook.json')
          setPriceBook(fallbackData.default as PriceBook)
          setError(null)
        } catch (fallbackError) {
          console.error('Fallback price book also failed:', fallbackError)
        }
      } finally {
        setLoading(false)
      }
    }

    loadPriceBook()
  }, [])

  // Get pricing for specific plan/period/country
  const getPrice = (
    planId: string, 
    period: string, 
    targetCountry?: string
  ): PriceBookEntry | null => {
    if (!priceBook) return null
    
    const country = targetCountry || countryCode
    const plan = priceBook.plans[planId]
    if (!plan) return null
    
    const countryPricing = plan.pricing[country]
    if (!countryPricing) {
      // Try fallback to US pricing
      const fallbackPricing = plan.pricing['US']
      if (fallbackPricing) {
        return fallbackPricing[period] || null
      }
      return null
    }
    
    return countryPricing[period] || null
  }

  // Get addon pricing
  const getAddonPrice = (
    addonId: string,
    targetCountry?: string
  ): Omit<PriceBookEntry, 'discount_pct' | 'savings_message'> | null => {
    if (!priceBook) return null
    
    const country = targetCountry || countryCode
    const addon = priceBook.addons[addonId]
    if (!addon) return null
    
    const countryPricing = addon.pricing[country]
    if (!countryPricing) {
      // Try fallback to US pricing
      const fallbackPricing = addon.pricing['US']
      return fallbackPricing || null
    }
    
    return countryPricing
  }

  // Get all plans for current country
  const getPlansForCountry = (targetCountry?: string) => {
    if (!priceBook) return []
    
    const country = targetCountry || countryCode
    
    return Object.entries(priceBook.plans).map(([planId, plan]) => ({
      id: planId,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      monthly: plan.pricing[country]?.monthly || plan.pricing['US']?.monthly || null,
      yearly: plan.pricing[country]?.yearly || plan.pricing['US']?.yearly || null
    })).filter(plan => plan.monthly || plan.yearly)
  }

  // Calculate savings for yearly vs monthly
  const getYearlySavings = (planId: string, targetCountry?: string) => {
    const monthly = getPrice(planId, 'monthly', targetCountry)
    const yearly = getPrice(planId, 'yearly', targetCountry)
    
    if (!monthly || !yearly) return null
    
    const monthlyTotal = monthly.psychological_price * 12
    const yearlyPrice = yearly.psychological_price
    const savings = monthlyTotal - yearlyPrice
    const savingsPercent = (savings / monthlyTotal) * 100
    
    return {
      savings,
      savingsPercent: Math.round(savingsPercent),
      monthlyTotal,
      yearlyPrice
    }
  }

  return {
    priceBook,
    loading,
    error,
    countryCode,
    getPrice,
    getAddonPrice,
    getPlansForCountry,
    getYearlySavings,
    reload: () => {
      setLoading(true)
      // Trigger reload by updating a dependency
    }
  }
}

// Utility hook for currency conversion
export function useCurrencyConverter() {
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})
  
  useEffect(() => {
    // Load exchange rates (could be from API or static config)
    const loadRates = async () => {
      try {
        // For now, use static rates from pricebook
        const response = await fetch('/config/pricebook.json')
        const data = await response.json()
        
        if (data.exchangeRates?.rates) {
          setExchangeRates(data.exchangeRates.rates)
        }
      } catch (error) {
        console.error('Failed to load exchange rates:', error)
        // Fallback to hardcoded rates
        setExchangeRates({
          'MXN': 20.0,
          'COP': 4000.0,
          'CLP': 800.0,
          'PEN': 3.8,
          'ARS': 350.0,
          'DOP': 58.0,
          'USD': 1.0
        })
      }
    }
    
    loadRates()
  }, [])
  
  const convertCurrency = (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): number => {
    if (fromCurrency === toCurrency) return amount
    
    const fromRate = exchangeRates[fromCurrency] || 1
    const toRate = exchangeRates[toCurrency] || 1
    
    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate
    return usdAmount * toRate
  }
  
  return {
    exchangeRates,
    convertCurrency
  }
}