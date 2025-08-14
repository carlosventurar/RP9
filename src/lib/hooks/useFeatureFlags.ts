'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { getCountryConfig } from '@/lib/i18n/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FeatureFlags {
  // Payment-related flags
  payment_methods: string[]
  payment_local_methods: boolean
  payment_crypto: boolean
  payment_bank_transfer: boolean
  
  // Billing-related flags
  billing_features: {
    dunning: boolean
    autopay: boolean
    payment_retry: boolean
    invoice_customization: boolean
  }
  
  // Marketplace flags
  marketplace_features: {
    local_templates: boolean
    local_currency: boolean
    creator_program: boolean
    premium_templates: boolean
  }
  
  // Compliance flags
  compliance_features: {
    tax_withholding: boolean
    electronic_invoice: boolean
    audit_trail: boolean
    data_residency: boolean
    gdpr_compliance: boolean
  }
  
  // UI flags
  ui_features: {
    show_tax_breakdown: boolean
    tax_inclusive_pricing: boolean
    currency_toggle: boolean
    local_phone_format: boolean
    local_date_format: boolean
  }
  
  // Experimental flags
  experimental: {
    ai_recommendations: boolean
    workflow_ai: boolean
    advanced_analytics: boolean
    beta_features: boolean
  }
}

interface UseFeatureFlagsReturn {
  flags: FeatureFlags
  loading: boolean
  error: string | null
  hasFeature: (featurePath: string) => boolean
  isPaymentMethodEnabled: (method: string) => boolean
  refreshFlags: () => Promise<void>
}

const DEFAULT_FLAGS: FeatureFlags = {
  payment_methods: ['card'],
  payment_local_methods: false,
  payment_crypto: false,
  payment_bank_transfer: false,
  
  billing_features: {
    dunning: true,
    autopay: true,
    payment_retry: true,
    invoice_customization: false
  },
  
  marketplace_features: {
    local_templates: true,
    local_currency: true,
    creator_program: false,
    premium_templates: true
  },
  
  compliance_features: {
    tax_withholding: false,
    electronic_invoice: false,
    audit_trail: true,
    data_residency: false,
    gdpr_compliance: true
  },
  
  ui_features: {
    show_tax_breakdown: false,
    tax_inclusive_pricing: true,
    currency_toggle: true,
    local_phone_format: true,
    local_date_format: true
  },
  
  experimental: {
    ai_recommendations: false,
    workflow_ai: false,
    advanced_analytics: false,
    beta_features: false
  }
}

export function useFeatureFlags(tenantId?: string): UseFeatureFlagsReturn {
  const locale = useLocale()
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const countryConfig = getCountryConfig(locale)
  const countryCode = countryConfig.country

  const loadFlags = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Load country-level flags
      const { data: countryFlags, error: countryError } = await supabase
        .from('country_feature_flags')
        .select('*')
        .eq('country_code', countryCode)
        .single()

      if (countryError && countryError.code !== 'PGRST116') {
        throw countryError
      }

      // Load tenant-level flags (if tenant ID provided)
      let tenantFlags = null
      if (tenantId) {
        const { data, error: tenantError } = await supabase
          .from('tenant_feature_flags')
          .select('*')
          .eq('tenant_id', tenantId)
          .single()

        if (tenantError && tenantError.code !== 'PGRST116') {
          throw tenantError
        }
        
        tenantFlags = data
      }

      // Merge flags: DEFAULT < COUNTRY < TENANT
      let mergedFlags = { ...DEFAULT_FLAGS }
      
      // Apply country flags
      if (countryFlags) {
        mergedFlags = {
          ...mergedFlags,
          payment_methods: countryFlags.payment_methods || mergedFlags.payment_methods,
          billing_features: { ...mergedFlags.billing_features, ...countryFlags.billing_features },
          marketplace_features: { ...mergedFlags.marketplace_features, ...countryFlags.marketplace_features },
          compliance_features: { ...mergedFlags.compliance_features, ...countryFlags.compliance_features },
          ui_features: { ...mergedFlags.ui_features, ...countryFlags.ui_features }
        }
      }
      
      // Apply tenant overrides
      if (tenantFlags) {
        mergedFlags = {
          ...mergedFlags,
          payment_methods: tenantFlags.payment_methods || mergedFlags.payment_methods,
          billing_features: { ...mergedFlags.billing_features, ...tenantFlags.billing_features },
          marketplace_features: { ...mergedFlags.marketplace_features, ...tenantFlags.marketplace_features },
          compliance_features: { ...mergedFlags.compliance_features, ...tenantFlags.compliance_features },
          ui_features: { ...mergedFlags.ui_features, ...tenantFlags.ui_features },
          experimental: { ...mergedFlags.experimental, ...tenantFlags.experimental }
        }
      }

      setFlags(mergedFlags)
      
    } catch (err) {
      console.error('Error loading feature flags:', err)
      setError(err instanceof Error ? err.message : 'Failed to load feature flags')
      setFlags(DEFAULT_FLAGS) // Fallback to defaults
    } finally {
      setLoading(false)
    }
  }, [countryCode, tenantId])

  useEffect(() => {
    loadFlags()
  }, [loadFlags])

  // Helper function to check if a feature is enabled using dot notation
  const hasFeature = useCallback((featurePath: string): boolean => {
    const keys = featurePath.split('.')
    let current: any = flags
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return false
      }
    }
    
    return Boolean(current)
  }, [flags])

  // Helper to check if a payment method is enabled
  const isPaymentMethodEnabled = useCallback((method: string): boolean => {
    return flags.payment_methods.includes(method)
  }, [flags.payment_methods])

  const refreshFlags = useCallback(async () => {
    await loadFlags()
  }, [loadFlags])

  return {
    flags,
    loading,
    error,
    hasFeature,
    isPaymentMethodEnabled,
    refreshFlags
  }
}

// Context provider for feature flags
import { createContext, useContext } from 'react'

interface FeatureFlagsContextType {
  flags: FeatureFlags
  hasFeature: (featurePath: string) => boolean
  isPaymentMethodEnabled: (method: string) => boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | null>(null)

export function FeatureFlagsProvider({ 
  children, 
  tenantId 
}: { 
  children: React.ReactNode
  tenantId?: string 
}) {
  const { flags, hasFeature, isPaymentMethodEnabled } = useFeatureFlags(tenantId)

  return (
    <FeatureFlagsContext.Provider value={{ flags, hasFeature, isPaymentMethodEnabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlagsContext(): FeatureFlagsContextType {
  const context = useContext(FeatureFlagsContext)
  if (!context) {
    throw new Error('useFeatureFlagsContext must be used within a FeatureFlagsProvider')
  }
  return context
}

// Higher-order component for feature gating
export function withFeatureFlag<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  featurePath: string,
  fallback?: React.ComponentType<T> | null
) {
  return function FeatureGatedComponent(props: T) {
    const { hasFeature } = useFeatureFlagsContext()
    
    if (!hasFeature(featurePath)) {
      if (fallback) {
        const FallbackComponent = fallback
        return <FallbackComponent {...props} />
      }
      return null
    }
    
    return <WrappedComponent {...props} />
  }
}

// Hook for specific feature types
export function usePaymentMethods() {
  const { flags, isPaymentMethodEnabled } = useFeatureFlagsContext()
  
  return {
    availableMethods: flags.payment_methods,
    isMethodEnabled: isPaymentMethodEnabled,
    hasLocalMethods: flags.payment_local_methods,
    hasCrypto: flags.payment_crypto,
    hasBankTransfer: flags.payment_bank_transfer
  }
}

export function useBillingFeatures() {
  const { flags } = useFeatureFlagsContext()
  
  return {
    ...flags.billing_features,
    hasAdvancedBilling: flags.billing_features.dunning && flags.billing_features.autopay
  }
}

export function useComplianceFeatures() {
  const { flags } = useFeatureFlagsContext()
  
  return {
    ...flags.compliance_features,
    requiresTaxId: flags.compliance_features.tax_withholding || flags.compliance_features.electronic_invoice,
    hasAdvancedCompliance: flags.compliance_features.audit_trail && flags.compliance_features.data_residency
  }
}