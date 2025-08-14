import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => require('next-router-mock'))

// Mock Next.js navigation
jest.mock('next/navigation', () => require('next-router-mock'))

// Mock next-intl
jest.mock('next-intl', () => ({
  useLocale: jest.fn(() => 'es-MX'),
  useTranslations: jest.fn(() => (key) => key),
  NextIntlClientProvider: ({ children }) => children,
}))

// Mock next-intl config
jest.mock('@/lib/i18n/config', () => ({
  getCountryConfig: jest.fn((locale) => ({
    country: locale === 'es-MX' ? 'MX' : 'US',
    currency: locale === 'es-MX' ? 'MXN' : 'USD',
    locale: locale || 'es-MX'
  }))
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'