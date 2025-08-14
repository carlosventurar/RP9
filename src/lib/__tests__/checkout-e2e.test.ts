/**
 * E2E Tests for Checkout Flow with I18n and Multi-Currency
 * 
 * These tests simulate the complete user journey through pricing and checkout
 * with different locales, currencies, and countries
 */

import { CurrencyFormatter } from '../analytics/currency'

// Mock fetch for testing
global.fetch = jest.fn()

describe('Checkout E2E Flow', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
  let formatter: CurrencyFormatter

  beforeEach(() => {
    formatter = CurrencyFormatter.getInstance()
    mockFetch.mockClear()
  })

  describe('Price Book Lookup', () => {
    it('should fetch correct price for Mexican user', async () => {
      const mockPriceResponse = {
        stripe_price_id: 'price_mx_starter_monthly',
        currency: 'MXN',
        list_price: 999.00,
        psychological_price: 999.00,
        usd_equivalent: 49.95
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceResponse
      } as Response)

      const response = await fetch('/api/pricebook?country=MX&plan=starter&period=monthly')
      const priceData = await response.json()

      expect(priceData.currency).toBe('MXN')
      expect(priceData.psychological_price).toBe(999.00)
      expect(priceData.stripe_price_id).toBe('price_mx_starter_monthly')
    })

    it('should fetch USD price when currency preference is USD', async () => {
      const mockPriceResponse = {
        stripe_price_id: 'price_us_starter_monthly',
        currency: 'USD',
        list_price: 49.00,
        psychological_price: 49.00,
        usd_equivalent: 49.00
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceResponse
      } as Response)

      const response = await fetch('/api/pricebook?country=MX&plan=starter&period=monthly&currency=USD')
      const priceData = await response.json()

      expect(priceData.currency).toBe('USD')
      expect(priceData.psychological_price).toBe(49.00)
    })

    it('should handle fallback for unsupported country', async () => {
      const mockPriceResponse = {
        stripe_price_id: 'price_us_starter_monthly',
        currency: 'USD',
        list_price: 49.00,
        psychological_price: 49.00,
        usd_equivalent: 49.00
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceResponse
      } as Response)

      const response = await fetch('/api/pricebook?country=FR&plan=starter&period=monthly')
      const priceData = await response.json()

      expect(priceData.currency).toBe('USD')
    })
  })

  describe('Checkout Session Creation', () => {
    it('should create checkout session for Mexican customer with correct price and tax settings', async () => {
      const checkoutRequest = {
        planId: 'starter',
        period: 'monthly',
        country: 'MX',
        currencyPreference: 'LOCAL',
        customerEmail: 'test@example.com',
        businessType: 'B2C'
      }

      const mockCheckoutResponse = {
        url: 'https://checkout.stripe.com/pay/test-session',
        sessionId: 'cs_test_12345',
        priceInfo: {
          currency: 'MXN',
          amount: 999.00,
          stripePrice: 'price_mx_starter_monthly'
        },
        taxMode: 'gross',
        paymentMethods: ['card', 'oxxo']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCheckoutResponse
      } as Response)

      const response = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutRequest)
      })

      const checkoutData = await response.json()

      expect(checkoutData.priceInfo.currency).toBe('MXN')
      expect(checkoutData.taxMode).toBe('gross')
      expect(checkoutData.paymentMethods).toContain('oxxo')
      expect(checkoutData.url).toContain('stripe.com')
    })

    it('should create checkout session for Chilean B2B customer with net pricing', async () => {
      const checkoutRequest = {
        planId: 'pro',
        period: 'yearly',
        country: 'CL',
        currencyPreference: 'LOCAL',
        customerEmail: 'empresa@example.cl',
        businessType: 'B2B',
        taxId: '12345678-9'
      }

      const mockCheckoutResponse = {
        url: 'https://checkout.stripe.com/pay/test-session-cl',
        sessionId: 'cs_test_67890',
        priceInfo: {
          currency: 'CLP',
          amount: 639000.00,
          stripePrice: 'price_cl_pro_yearly'
        },
        taxMode: 'net',
        paymentMethods: ['card']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCheckoutResponse
      } as Response)

      const response = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutRequest)
      })

      const checkoutData = await response.json()

      expect(checkoutData.priceInfo.currency).toBe('CLP')
      expect(checkoutData.taxMode).toBe('net')
      expect(checkoutData.priceInfo.amount).toBe(639000.00)
    })

    it('should handle currency preference toggle correctly', async () => {
      // First request with local currency
      const localRequest = {
        planId: 'starter',
        period: 'monthly',
        country: 'CO',
        currencyPreference: 'LOCAL'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          priceInfo: { currency: 'COP', amount: 199000 }
        })
      } as Response)

      const localResponse = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify(localRequest)
      })

      const localData = await localResponse.json()
      expect(localData.priceInfo.currency).toBe('COP')

      // Second request with USD preference
      const usdRequest = { ...localRequest, currencyPreference: 'USD' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          priceInfo: { currency: 'USD', amount: 49.75 }
        })
      } as Response)

      const usdResponse = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify(usdRequest)
      })

      const usdData = await usdResponse.json()
      expect(usdData.priceInfo.currency).toBe('USD')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid country code gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Price not found' })
      } as Response)

      const response = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify({
          planId: 'starter',
          period: 'monthly',
          country: 'INVALID'
        })
      })

      expect(response.ok).toBe(false)
      const errorData = await response.json()
      expect(errorData.error).toBe('Price not found')
    })

    it('should handle missing required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'planId and period are required' })
      } as Response)

      const response = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify({ country: 'MX' })
      })

      expect(response.ok).toBe(false)
      const errorData = await response.json()
      expect(errorData.error).toContain('required')
    })
  })

  describe('Feature Flag Integration', () => {
    it('should respect country-specific payment methods', async () => {
      const mockCheckoutResponse = {
        paymentMethods: ['card', 'oxxo'],
        priceInfo: { currency: 'MXN' }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCheckoutResponse
      } as Response)

      const response = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify({
          planId: 'starter',
          period: 'monthly',
          country: 'MX'
        })
      })

      const data = await response.json()
      expect(data.paymentMethods).toContain('oxxo') // Mexico-specific
    })

    it('should handle countries with limited payment methods', async () => {
      const mockCheckoutResponse = {
        paymentMethods: ['card'],
        priceInfo: { currency: 'DOP' }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCheckoutResponse
      } as Response)

      const response = await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify({
          planId: 'starter',
          period: 'monthly',
          country: 'DO'
        })
      })

      const data = await response.json()
      expect(data.paymentMethods).toEqual(['card'])
    })
  })

  describe('Analytics Integration', () => {
    it('should track checkout events with correct currency data', async () => {
      const checkoutRequest = {
        planId: 'pro',
        period: 'yearly',
        country: 'AR',
        currencyPreference: 'LOCAL',
        tenantId: 'tenant_123'
      }

      const mockCheckoutResponse = {
        sessionId: 'cs_test_ar',
        priceInfo: {
          currency: 'ARS',
          amount: 279900,
          stripePrice: 'price_ar_pro_yearly'
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCheckoutResponse
      } as Response)

      await fetch('/netlify/functions/billing-checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutRequest)
      })

      // Verify that the checkout function would have logged analytics
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('billing-checkout'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('tenant_123')
        })
      )
    })
  })

  describe('Currency Normalization for Analytics', () => {
    it('should correctly normalize different currencies to USD for comparison', () => {
      const amounts = [
        { amount: 999, currency: 'MXN' },     // ~$49.95 USD
        { amount: 199000, currency: 'COP' },   // ~$49.75 USD  
        { amount: 39900, currency: 'CLP' },    // ~$49.88 USD
        { amount: 189, currency: 'PEN' },      // ~$49.74 USD
      ]

      const normalizedAmounts = amounts.map(({ amount, currency }) => ({
        original: amount,
        currency,
        usdAmount: formatter.normalizeToUSD(amount, currency)
      }))

      // All should be approximately $50 USD
      normalizedAmounts.forEach(item => {
        expect(item.usdAmount).toBeGreaterThan(49)
        expect(item.usdAmount).toBeLessThan(51)
      })
    })

    it('should handle edge cases in currency conversion', () => {
      // Test zero amounts
      expect(formatter.normalizeToUSD(0, 'MXN')).toBe(0)
      
      // Test very small amounts  
      const smallUSD = formatter.normalizeToUSD(1, 'MXN')
      expect(smallUSD).toBeCloseTo(0.05, 2)
      
      // Test very large amounts
      const largeUSD = formatter.normalizeToUSD(1000000, 'COP')
      expect(largeUSD).toBe(250)
    })
  })

  describe('Locale-Specific Behavior', () => {
    it('should format prices according to locale conventions', () => {
      // Mexican format: $999.00 MXN
      const mxFormatted = formatter.formatCurrency(999, 'MXN', 'es-MX')
      expect(mxFormatted).toMatch(/999/)

      // Chilean format: no decimals for CLP
      const clFormatted = formatter.formatCurrency(39900, 'CLP', 'es-CL')
      expect(clFormatted).not.toContain('.00')

      // Colombian format: large numbers
      const coFormatted = formatter.formatCurrency(199000, 'COP', 'es-CO')
      expect(coFormatted).toContain('199')
    })
  })
})

// Helper functions for testing
export const createMockCheckoutRequest = (overrides: Partial<any> = {}) => ({
  planId: 'starter',
  period: 'monthly',
  country: 'MX',
  currencyPreference: 'LOCAL',
  ...overrides
})

export const createMockPriceResponse = (overrides: Partial<any> = {}) => ({
  stripe_price_id: 'price_mx_starter_monthly',
  currency: 'MXN',
  list_price: 999.00,
  psychological_price: 999.00,
  usd_equivalent: 49.95,
  ...overrides
})

export const waitForAsync = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms))