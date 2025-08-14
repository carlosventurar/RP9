/**
 * Currency utilities for multi-currency analytics
 * Handles normalization to USD for reporting and local display
 */

interface CurrencyAmount {
  amount: number
  currency: string
  usdAmount?: number
  exchangeRate?: number
  timestamp?: Date
}

interface ExchangeRate {
  from: string
  to: string
  rate: number
  timestamp: Date
  source: string
}

// Static exchange rates (in production, these would come from a rates API)
const STATIC_EXCHANGE_RATES: Record<string, number> = {
  'USD': 1.0,
  'MXN': 20.0,
  'COP': 4000.0,
  'CLP': 800.0,
  'PEN': 3.8,
  'ARS': 350.0,
  'DOP': 58.0
}

/**
 * Currency formatter with locale support
 */
export class CurrencyFormatter {
  private static instance: CurrencyFormatter
  private exchangeRates: Map<string, ExchangeRate> = new Map()
  
  static getInstance(): CurrencyFormatter {
    if (!CurrencyFormatter.instance) {
      CurrencyFormatter.instance = new CurrencyFormatter()
    }
    return CurrencyFormatter.instance
  }
  
  /**
   * Format amount in specific currency with locale formatting
   */
  formatCurrency(
    amount: number,
    currency: string,
    locale: string = 'en-US',
    options: Intl.NumberFormatOptions = {}
  ): string {
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'CLP' || currency === 'COP' ? 0 : 2,
        maximumFractionDigits: currency === 'CLP' || currency === 'COP' ? 0 : 2,
        ...options
      })
      
      return formatter.format(amount)
    } catch (error) {
      // Fallback formatting
      const symbol = this.getCurrencySymbol(currency)
      return `${symbol}${amount.toLocaleString()}`
    }
  }
  
  /**
   * Get currency symbol
   */
  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      'USD': '$',
      'MXN': '$',
      'COP': '$',
      'CLP': '$',
      'PEN': 'S/',
      'ARS': '$',
      'DOP': 'RD$'
    }
    
    return symbols[currency] || currency
  }
  
  /**
   * Convert amount between currencies
   */
  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRates?: Record<string, number>
  ): number {
    if (fromCurrency === toCurrency) return amount
    
    const rates = exchangeRates || STATIC_EXCHANGE_RATES
    const fromRate = rates[fromCurrency] || 1
    const toRate = rates[toCurrency] || 1
    
    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate
    return usdAmount * toRate
  }
  
  /**
   * Normalize amount to USD for analytics
   */
  normalizeToUSD(amount: number, currency: string): number {
    return this.convertCurrency(amount, currency, 'USD')
  }
  
  /**
   * Create a currency amount object with USD normalization
   */
  createCurrencyAmount(
    amount: number,
    currency: string,
    exchangeRates?: Record<string, number>
  ): CurrencyAmount {
    const usdAmount = this.normalizeToUSD(amount, currency)
    const exchangeRate = exchangeRates?.[currency] || STATIC_EXCHANGE_RATES[currency]
    
    return {
      amount,
      currency,
      usdAmount,
      exchangeRate,
      timestamp: new Date()
    }
  }
}

/**
 * Analytics aggregator for multi-currency data
 */
export class MultiCurrencyAnalytics {
  private formatter = CurrencyFormatter.getInstance()
  
  /**
   * Aggregate amounts by currency
   */
  aggregateByCurrency(amounts: CurrencyAmount[]): Record<string, number> {
    const totals: Record<string, number> = {}
    
    for (const amount of amounts) {
      if (!totals[amount.currency]) {
        totals[amount.currency] = 0
      }
      totals[amount.currency] += amount.amount
    }
    
    return totals
  }
  
  /**
   * Aggregate amounts normalized to USD
   */
  aggregateInUSD(amounts: CurrencyAmount[]): number {
    return amounts.reduce((total, amount) => {
      return total + (amount.usdAmount || this.formatter.normalizeToUSD(amount.amount, amount.currency))
    }, 0)
  }
  
  /**
   * Calculate revenue by currency with USD totals
   */
  calculateRevenueSummary(amounts: CurrencyAmount[]) {
    const byCurrency = this.aggregateByCurrency(amounts)
    const totalUSD = this.aggregateInUSD(amounts)
    
    const currencySummary = Object.entries(byCurrency).map(([currency, total]) => ({
      currency,
      amount: total,
      usdEquivalent: this.formatter.normalizeToUSD(total, currency),
      formatted: this.formatter.formatCurrency(total, currency),
      percentage: totalUSD > 0 ? (this.formatter.normalizeToUSD(total, currency) / totalUSD) * 100 : 0
    }))
    
    return {
      totalUSD,
      totalUSDFormatted: this.formatter.formatCurrency(totalUSD, 'USD'),
      currencies: currencySummary,
      primaryCurrency: currencySummary.sort((a, b) => b.usdEquivalent - a.usdEquivalent)[0]?.currency || 'USD'
    }
  }
  
  /**
   * Generate time series data with currency normalization
   */
  generateTimeSeries(
    data: Array<{ date: Date; amounts: CurrencyAmount[] }>,
    targetCurrency: string = 'USD'
  ) {
    return data.map(item => {
      const convertedAmounts = item.amounts.map(amount => ({
        ...amount,
        convertedAmount: this.formatter.convertCurrency(
          amount.amount,
          amount.currency,
          targetCurrency
        )
      }))
      
      const total = convertedAmounts.reduce((sum, amount) => sum + amount.convertedAmount, 0)
      
      return {
        date: item.date,
        total,
        totalFormatted: this.formatter.formatCurrency(total, targetCurrency),
        amounts: convertedAmounts,
        currency: targetCurrency
      }
    })
  }
  
  /**
   * Calculate growth rates with currency normalization
   */
  calculateGrowthRate(
    current: CurrencyAmount[],
    previous: CurrencyAmount[],
    targetCurrency: string = 'USD'
  ): {
    growthRate: number
    currentTotal: number
    previousTotal: number
    currency: string
  } {
    const currentTotal = this.aggregateInUSD(current)
    const previousTotal = this.aggregateInUSD(previous)
    
    if (targetCurrency !== 'USD') {
      const convertedCurrent = this.formatter.convertCurrency(currentTotal, 'USD', targetCurrency)
      const convertedPrevious = this.formatter.convertCurrency(previousTotal, 'USD', targetCurrency)
      
      return {
        growthRate: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0,
        currentTotal: convertedCurrent,
        previousTotal: convertedPrevious,
        currency: targetCurrency
      }
    }
    
    return {
      growthRate: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0,
      currentTotal,
      previousTotal,
      currency: 'USD'
    }
  }
}

/**
 * React hook for multi-currency analytics
 */
import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { getCountryConfig } from '@/lib/i18n/config'

export function useMultiCurrencyAnalytics() {
  const locale = useLocale()
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(STATIC_EXCHANGE_RATES)
  const [loading, setLoading] = useState(false)
  
  const countryConfig = getCountryConfig(locale)
  const localCurrency = countryConfig.currency
  
  const formatter = CurrencyFormatter.getInstance()
  const analytics = new MultiCurrencyAnalytics()
  
  // Load exchange rates (could be from an API in production)
  useEffect(() => {
    const loadExchangeRates = async () => {
      setLoading(true)
      try {
        // In production, this would fetch from an exchange rate API
        // For now, we use static rates
        setExchangeRates(STATIC_EXCHANGE_RATES)
      } catch (error) {
        console.error('Failed to load exchange rates:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadExchangeRates()
  }, [])
  
  return {
    // Utilities
    formatter,
    analytics,
    localCurrency,
    exchangeRates,
    loading,
    
    // Convenience methods
    formatCurrency: (amount: number, currency?: string) => 
      formatter.formatCurrency(amount, currency || localCurrency, locale),
    
    formatInUSD: (amount: number, currency?: string) =>
      formatter.formatCurrency(
        formatter.normalizeToUSD(amount, currency || localCurrency),
        'USD',
        'en-US'
      ),
    
    convertToLocal: (amount: number, fromCurrency: string) =>
      formatter.convertCurrency(amount, fromCurrency, localCurrency),
    
    normalizeToUSD: (amount: number, currency?: string) =>
      formatter.normalizeToUSD(amount, currency || localCurrency),
    
    createAmount: (amount: number, currency?: string) =>
      formatter.createCurrencyAmount(amount, currency || localCurrency, exchangeRates)
  }
}

/**
 * Utility functions for analytics components
 */
export const CurrencyUtils = {
  // Format number with compact notation (1K, 1M, etc.)
  formatCompact: (amount: number, currency: string, locale: string = 'en-US') => {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      notation: 'compact',
      maximumFractionDigits: 1
    })
    
    return formatter.format(amount)
  },
  
  // Get appropriate chart color for currency
  getCurrencyColor: (currency: string): string => {
    const colors: Record<string, string> = {
      'USD': '#22c55e', // Green
      'MXN': '#f59e0b', // Amber
      'COP': '#3b82f6', // Blue
      'CLP': '#8b5cf6', // Purple
      'PEN': '#ef4444', // Red
      'ARS': '#06b6d4', // Cyan
      'DOP': '#f97316'  // Orange
    }
    
    return colors[currency] || '#6b7280' // Gray fallback
  },
  
  // Determine if amount is significant (for filtering small amounts)
  isSignificantAmount: (amount: number, currency: string, threshold: number = 1): boolean => {
    const usdAmount = CurrencyFormatter.getInstance().normalizeToUSD(amount, currency)
    return usdAmount >= threshold
  }
}