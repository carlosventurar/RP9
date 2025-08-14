/**
 * Tests for i18n and currency utilities
 */

import { CurrencyFormatter, MultiCurrencyAnalytics } from '../analytics/currency'
import { validateTaxIdByCountry, getTaxIdConfig } from '../../components/billing/TaxIdField'

describe('CurrencyFormatter', () => {
  let formatter: CurrencyFormatter

  beforeEach(() => {
    formatter = CurrencyFormatter.getInstance()
  })

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const formatted = formatter.formatCurrency(1234.56, 'USD', 'en-US')
      expect(formatted).toBe('$1,234.56')
    })

    it('should format Mexican Pesos correctly', () => {
      const formatted = formatter.formatCurrency(1999, 'MXN', 'es-MX')
      expect(formatted).toMatch(/1,999|1999/)
      // In test environment, it might show $ instead of MXN
      expect(formatted).toMatch(/MXN|\$/)
    })

    it('should format Chilean Pesos without decimals', () => {
      const formatted = formatter.formatCurrency(39900, 'CLP', 'es-CL')
      // CLP should format without decimals
      expect(formatted).toMatch(/39[.,]?900|39900/)
    })

    it('should handle fallback formatting for unsupported locales', () => {
      const formatted = formatter.formatCurrency(1000, 'USD', 'invalid-locale')
      expect(formatted).toContain('$')
      // May contain 1000 or 1,000 depending on formatting
      expect(formatted).toMatch(/1,?000/)
    })
  })

  describe('getCurrencySymbol', () => {
    it('should return correct symbols for supported currencies', () => {
      expect(formatter.getCurrencySymbol('USD')).toBe('$')
      expect(formatter.getCurrencySymbol('MXN')).toBe('$')
      expect(formatter.getCurrencySymbol('PEN')).toBe('S/')
      expect(formatter.getCurrencySymbol('DOP')).toBe('RD$')
    })

    it('should fallback to currency code for unsupported currencies', () => {
      expect(formatter.getCurrencySymbol('EUR')).toBe('EUR')
    })
  })

  describe('convertCurrency', () => {
    it('should convert between currencies correctly', () => {
      // MXN to USD (rate: 20)
      const usdAmount = formatter.convertCurrency(2000, 'MXN', 'USD')
      expect(usdAmount).toBe(100)
    })

    it('should return same amount for same currency', () => {
      const amount = formatter.convertCurrency(1000, 'USD', 'USD')
      expect(amount).toBe(1000)
    })

    it('should handle conversion with custom rates', () => {
      const customRates = { 'MXN': 18.5, 'USD': 1 }
      const usdAmount = formatter.convertCurrency(1850, 'MXN', 'USD', customRates)
      expect(usdAmount).toBe(100)
    })
  })

  describe('normalizeToUSD', () => {
    it('should normalize different currencies to USD', () => {
      expect(formatter.normalizeToUSD(2000, 'MXN')).toBe(100)
      expect(formatter.normalizeToUSD(400000, 'COP')).toBe(100)
      expect(formatter.normalizeToUSD(80000, 'CLP')).toBe(100)
    })

    it('should return same amount for USD', () => {
      expect(formatter.normalizeToUSD(100, 'USD')).toBe(100)
    })
  })

  describe('createCurrencyAmount', () => {
    it('should create currency amount with USD normalization', () => {
      const amount = formatter.createCurrencyAmount(2000, 'MXN')
      
      expect(amount.amount).toBe(2000)
      expect(amount.currency).toBe('MXN')
      expect(amount.usdAmount).toBe(100)
      expect(amount.exchangeRate).toBe(20)
      expect(amount.timestamp).toBeInstanceOf(Date)
    })
  })
})

describe('MultiCurrencyAnalytics', () => {
  let analytics: MultiCurrencyAnalytics

  beforeEach(() => {
    analytics = new MultiCurrencyAnalytics()
  })

  describe('aggregateByCurrency', () => {
    it('should aggregate amounts by currency', () => {
      const amounts = [
        { amount: 1000, currency: 'USD', usdAmount: 1000 },
        { amount: 2000, currency: 'MXN', usdAmount: 100 },
        { amount: 500, currency: 'USD', usdAmount: 500 },
      ]

      const totals = analytics.aggregateByCurrency(amounts)
      
      expect(totals.USD).toBe(1500)
      expect(totals.MXN).toBe(2000)
    })
  })

  describe('aggregateInUSD', () => {
    it('should aggregate all amounts in USD', () => {
      const amounts = [
        { amount: 1000, currency: 'USD', usdAmount: 1000 },
        { amount: 2000, currency: 'MXN', usdAmount: 100 },
        { amount: 80000, currency: 'CLP', usdAmount: 100 },
      ]

      const totalUSD = analytics.aggregateInUSD(amounts)
      expect(totalUSD).toBe(1200)
    })
  })

  describe('calculateRevenueSummary', () => {
    it('should calculate revenue summary with percentages', () => {
      const amounts = [
        { amount: 1000, currency: 'USD', usdAmount: 1000 },
        { amount: 2000, currency: 'MXN', usdAmount: 100 },
      ]

      const summary = analytics.calculateRevenueSummary(amounts)
      
      expect(summary.totalUSD).toBe(1100)
      expect(summary.currencies).toHaveLength(2)
      expect(summary.primaryCurrency).toBe('USD')
      
      const usdCurrency = summary.currencies.find(c => c.currency === 'USD')
      expect(usdCurrency?.percentage).toBeCloseTo(90.91, 1)
    })
  })

  describe('calculateGrowthRate', () => {
    it('should calculate growth rate correctly', () => {
      const current = [{ amount: 1100, currency: 'USD', usdAmount: 1100 }]
      const previous = [{ amount: 1000, currency: 'USD', usdAmount: 1000 }]

      const growth = analytics.calculateGrowthRate(current, previous)
      
      expect(growth.growthRate).toBe(10)
      expect(growth.currentTotal).toBe(1100)
      expect(growth.previousTotal).toBe(1000)
      expect(growth.currency).toBe('USD')
    })

    it('should handle zero previous total', () => {
      const current = [{ amount: 1000, currency: 'USD', usdAmount: 1000 }]
      const previous: any[] = []

      const growth = analytics.calculateGrowthRate(current, previous)
      
      expect(growth.growthRate).toBe(0)
      expect(growth.currentTotal).toBe(1000)
      expect(growth.previousTotal).toBe(0)
    })
  })
})

describe('TaxId Validation', () => {
  describe('getTaxIdConfig', () => {
    it('should return config for supported countries', () => {
      const mxConfig = getTaxIdConfig('MX')
      expect(mxConfig?.label).toBe('RFC')
      expect(mxConfig?.required).toBe(true)

      const clConfig = getTaxIdConfig('CL')
      expect(clConfig?.label).toBe('RUT')
      expect(clConfig?.pattern).toContain('0-9')
    })

    it('should return null for unsupported countries', () => {
      const config = getTaxIdConfig('FR')
      expect(config).toBeNull()
    })
  })

  describe('validateTaxIdByCountry', () => {
    it('should validate Mexican RFC format', () => {
      expect(validateTaxIdByCountry('XAXX010101000', 'MX')).toBe(true)
      expect(validateTaxIdByCountry('INVALID', 'MX')).toBe(false)
    })

    it('should validate Colombian NIT format', () => {
      expect(validateTaxIdByCountry('900123456-7', 'CO')).toBe(true)
      expect(validateTaxIdByCountry('90012345', 'CO')).toBe(false)
    })

    it('should validate Chilean RUT format', () => {
      expect(validateTaxIdByCountry('12345678-9', 'CL')).toBe(true)
      expect(validateTaxIdByCountry('12345678-K', 'CL')).toBe(true)
      expect(validateTaxIdByCountry('1234567', 'CL')).toBe(false)
    })

    it('should validate Peruvian RUC format', () => {
      expect(validateTaxIdByCountry('20123456789', 'PE')).toBe(true)
      expect(validateTaxIdByCountry('2012345678', 'PE')).toBe(false)
    })

    it('should validate Argentine CUIT format', () => {
      expect(validateTaxIdByCountry('20-12345678-9', 'AR')).toBe(true)
      expect(validateTaxIdByCountry('20123456789', 'AR')).toBe(false)
    })

    it('should validate Dominican RNC format', () => {
      expect(validateTaxIdByCountry('123456789', 'DO')).toBe(true)
      expect(validateTaxIdByCountry('12345678', 'DO')).toBe(false)
    })

    it('should return true for unsupported countries', () => {
      expect(validateTaxIdByCountry('anything', 'FR')).toBe(true)
    })
  })
})

describe('Currency Utilities', () => {
  describe('Exchange Rate Calculations', () => {
    it('should handle edge cases in conversion', () => {
      const formatter = CurrencyFormatter.getInstance()
      
      // Zero amounts
      expect(formatter.convertCurrency(0, 'MXN', 'USD')).toBe(0)
      
      // Negative amounts
      expect(formatter.convertCurrency(-100, 'USD', 'MXN')).toBe(-2000)
      
      // Very small amounts
      const smallAmount = formatter.convertCurrency(0.01, 'USD', 'MXN')
      expect(smallAmount).toBeCloseTo(0.2, 1)
    })
  })

  describe('Locale-specific Formatting', () => {
    it('should format numbers according to locale', () => {
      const formatter = CurrencyFormatter.getInstance()
      
      // Spanish locale uses comma as decimal separator in some countries
      const clpAmount = formatter.formatCurrency(39900, 'CLP', 'es-CL')
      expect(clpAmount).toMatch(/39[.,]900/)
      
      // US locale uses period as decimal separator
      const usdAmount = formatter.formatCurrency(1234.56, 'USD', 'en-US')
      expect(usdAmount).toContain('1,234.56')
    })
  })
})

// Mock data for testing
export const mockCurrencyAmounts = [
  { amount: 1000, currency: 'USD', usdAmount: 1000 },
  { amount: 20000, currency: 'MXN', usdAmount: 1000 },
  { amount: 4000000, currency: 'COP', usdAmount: 1000 },
  { amount: 800000, currency: 'CLP', usdAmount: 1000 },
  { amount: 3800, currency: 'PEN', usdAmount: 1000 },
  { amount: 350000, currency: 'ARS', usdAmount: 1000 },
  { amount: 58000, currency: 'DOP', usdAmount: 1000 },
]

export const mockTimeSeriesData = [
  {
    date: new Date('2024-01-01'),
    amounts: [
      { amount: 500, currency: 'USD', usdAmount: 500 },
      { amount: 10000, currency: 'MXN', usdAmount: 500 }
    ]
  },
  {
    date: new Date('2024-01-02'), 
    amounts: [
      { amount: 750, currency: 'USD', usdAmount: 750 },
      { amount: 15000, currency: 'MXN', usdAmount: 750 }
    ]
  }
]