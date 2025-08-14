'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getCountryConfig } from '@/lib/i18n/config'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { DollarSign, Globe } from 'lucide-react'

interface CurrencyToggleProps {
  onCurrencyChange: (currency: 'LOCAL' | 'USD') => void
  initialCurrency?: 'LOCAL' | 'USD'
  variant?: 'switch' | 'button'
  className?: string
}

export function CurrencyToggle({ 
  onCurrencyChange, 
  initialCurrency = 'LOCAL',
  variant = 'switch',
  className = ''
}: CurrencyToggleProps) {
  const locale = useLocale()
  const t = useTranslations()
  const [showUSD, setShowUSD] = useState(initialCurrency === 'USD')
  
  const countryConfig = getCountryConfig(locale)
  const isUSDCountry = countryConfig.currency === 'USD'
  
  const handleToggle = (newShowUSD: boolean) => {
    setShowUSD(newShowUSD)
    onCurrencyChange(newShowUSD ? 'USD' : 'LOCAL')
    
    // Save preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('rp9-currency-preference', newShowUSD ? 'USD' : 'LOCAL')
    }
  }

  // Don't show toggle for USD countries (no point in toggling USD <-> USD)
  if (isUSDCountry) {
    return null
  }

  if (variant === 'button') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <Button
          variant={!showUSD ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleToggle(false)}
          className="h-8 px-3"
        >
          <Globe size={14} className="mr-1" />
          {countryConfig.currency}
        </Button>
        <Button
          variant={showUSD ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleToggle(true)}
          className="h-8 px-3"
        >
          <DollarSign size={14} className="mr-1" />
          USD
        </Button>
      </div>
    )
  }

  // Switch variant (default)
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Label 
        htmlFor="currency-toggle" 
        className={`text-sm font-medium transition-colors ${
          !showUSD ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {countryConfig.currency}
      </Label>
      
      <Switch
        id="currency-toggle"
        checked={showUSD}
        onCheckedChange={handleToggle}
        className="data-[state=checked]:bg-blue-600"
      />
      
      <Label 
        htmlFor="currency-toggle" 
        className={`text-sm font-medium transition-colors ${
          showUSD ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        USD
      </Label>
      
      {/* Helper text */}
      <span className="text-xs text-muted-foreground ml-2">
        {showUSD 
          ? t('currency.showing_usd', { default: 'Showing USD prices' })
          : t('currency.showing_local', { 
              default: `Showing ${countryConfig.currency} prices`,
              currency: countryConfig.currency 
            })
        }
      </span>
    </div>
  )
}

// Hook para usar el estado de moneda
export function useCurrencyPreference() {
  const [currency, setCurrency] = useState<'LOCAL' | 'USD'>(() => {
    if (typeof window === 'undefined') return 'LOCAL'
    const saved = localStorage.getItem('rp9-currency-preference')
    return (saved as 'LOCAL' | 'USD') || 'LOCAL'
  })

  const updateCurrency = (newCurrency: 'LOCAL' | 'USD') => {
    setCurrency(newCurrency)
    if (typeof window !== 'undefined') {
      localStorage.setItem('rp9-currency-preference', newCurrency)
    }
  }

  return { currency, setCurrency: updateCurrency }
}