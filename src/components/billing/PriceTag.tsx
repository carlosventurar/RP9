'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getCountryConfig } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, Info } from 'lucide-react'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PriceData {
  localPrice: number
  localCurrency: string
  usdPrice: number
  period?: 'monthly' | 'yearly' | 'one_time'
  discountPct?: number
  savingsMessage?: string
}

interface PriceTagProps {
  priceData: PriceData
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showToggle?: boolean
  initialCurrency?: 'LOCAL' | 'USD'
  variant?: 'default' | 'card' | 'inline'
  className?: string
  onCurrencyChange?: (currency: 'LOCAL' | 'USD') => void
}

export function PriceTag({
  priceData,
  size = 'md',
  showToggle = true,
  initialCurrency = 'LOCAL',
  variant = 'default',
  className = '',
  onCurrencyChange
}: PriceTagProps) {
  const locale = useLocale()
  const t = useTranslations()
  const [displayCurrency, setDisplayCurrency] = useState<'LOCAL' | 'USD'>(initialCurrency)
  
  const countryConfig = getCountryConfig(locale)
  const isUSDCountry = countryConfig.currency === 'USD'
  
  const currentPrice = displayCurrency === 'USD' ? priceData.usdPrice : priceData.localPrice
  const currentCurrency = displayCurrency === 'USD' ? 'USD' : priceData.localCurrency
  const alternativePrice = displayCurrency === 'USD' ? priceData.localPrice : priceData.usdPrice
  const alternativeCurrency = displayCurrency === 'USD' ? priceData.localCurrency : 'USD'
  
  const handleToggle = () => {
    const newCurrency = displayCurrency === 'LOCAL' ? 'USD' : 'LOCAL'
    setDisplayCurrency(newCurrency)
    onCurrencyChange?.(newCurrency)
  }
  
  // Format price with proper locale formatting
  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'CLP' || currency === 'COP' ? 0 : 2,
        maximumFractionDigits: currency === 'CLP' || currency === 'COP' ? 0 : 2,
      }).format(price)
    } catch (error) {
      // Fallback formatting if Intl fails
      return `${currency} ${price.toLocaleString()}`
    }
  }

  // Size configurations
  const sizeConfig = {
    sm: {
      price: 'text-lg font-bold',
      currency: 'text-xs',
      toggle: 'text-xs px-2 py-1',
      period: 'text-xs'
    },
    md: {
      price: 'text-2xl font-bold',
      currency: 'text-sm',
      toggle: 'text-sm px-3 py-1',
      period: 'text-sm'
    },
    lg: {
      price: 'text-3xl font-bold',
      currency: 'text-base',
      toggle: 'text-sm px-3 py-2',
      period: 'text-base'
    },
    xl: {
      price: 'text-4xl font-bold',
      currency: 'text-lg',
      toggle: 'text-base px-4 py-2',
      period: 'text-lg'
    }
  }

  const config = sizeConfig[size]

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className={`${config.price} text-foreground`}>
          {formatPrice(currentPrice, currentCurrency)}
        </span>
        {priceData.period && (
          <span className={`${config.period} text-muted-foreground`}>
            /{priceData.period === 'monthly' ? t('billing.per_month', { default: 'mes' }) : 
              priceData.period === 'yearly' ? t('billing.per_year', { default: 'año' }) : ''}
          </span>
        )}
        {showToggle && !isUSDCountry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className={`${config.toggle} text-muted-foreground hover:text-foreground`}
          >
            ≈ {formatPrice(alternativePrice, alternativeCurrency)}
          </Button>
        )}
      </span>
    )
  }

  if (variant === 'card') {
    return (
      <div className={`p-4 rounded-lg border ${className}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className={`${config.price} text-foreground`}>
              {formatPrice(currentPrice, currentCurrency)}
            </div>
            {priceData.period && (
              <div className={`${config.period} text-muted-foreground mt-1`}>
                {priceData.period === 'monthly' ? t('billing.billed_monthly', { default: 'Facturado mensualmente' }) : 
                 priceData.period === 'yearly' ? t('billing.billed_yearly', { default: 'Facturado anualmente' }) : ''}
              </div>
            )}
            
            {priceData.discountPct && priceData.discountPct > 0 && (
              <Badge variant="secondary" className="mt-2">
                {priceData.savingsMessage || t('billing.save_percent', { 
                  default: `Ahorra ${Math.round(priceData.discountPct)}%`,
                  percent: Math.round(priceData.discountPct)
                })}
              </Badge>
            )}
          </div>
          
          {showToggle && !isUSDCountry && (
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggle}
                className="gap-2"
              >
                <ArrowUpDown size={14} />
                {displayCurrency === 'LOCAL' ? 'Ver USD' : `Ver ${priceData.localCurrency}`}
              </Button>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                      <Info size={12} />
                      ≈ {formatPrice(alternativePrice, alternativeCurrency)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">
                      {displayCurrency === 'LOCAL' 
                        ? t('billing.usd_equivalent', { default: 'Equivalente aproximado en USD' })
                        : t('billing.local_equivalent', { 
                            default: `Equivalente aproximado en ${priceData.localCurrency}`,
                            currency: priceData.localCurrency
                          })
                      }
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`${config.price} text-foreground`}>
            {formatPrice(currentPrice, currentCurrency)}
          </span>
          {priceData.period && (
            <span className={`${config.period} text-muted-foreground`}>
              /{priceData.period === 'monthly' ? t('billing.per_month', { default: 'mes' }) : 
                priceData.period === 'yearly' ? t('billing.per_year', { default: 'año' }) : ''}
            </span>
          )}
        </div>
        
        {priceData.discountPct && priceData.discountPct > 0 && (
          <div className="mt-2">
            <Badge variant="secondary">
              {priceData.savingsMessage || t('billing.save_percent', { 
                default: `Ahorra ${Math.round(priceData.discountPct)}%`,
                percent: Math.round(priceData.discountPct)
              })}
            </Badge>
          </div>
        )}
      </div>
      
      {showToggle && !isUSDCountry && (
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className={`${config.toggle} text-muted-foreground hover:text-foreground`}
          >
            <ArrowUpDown size={14} className="mr-1" />
            {displayCurrency === 'LOCAL' ? 'Ver USD' : `Ver ${priceData.localCurrency}`}
          </Button>
          
          <span className="text-xs text-muted-foreground">
            ≈ {formatPrice(alternativePrice, alternativeCurrency)}
          </span>
        </div>
      )}
    </div>
  )
}

// Utility function to get price data from price book
export function getPriceData(
  plan: string,
  period: string,
  country: string,
  pricebook: any
): PriceData | null {
  try {
    const planData = pricebook?.plans?.[plan]
    if (!planData) return null
    
    const countryPricing = planData.pricing?.[country]
    if (!countryPricing) return null
    
    const periodPricing = countryPricing[period]
    if (!periodPricing) return null
    
    return {
      localPrice: periodPricing.psychological_price || periodPricing.list_price,
      localCurrency: periodPricing.currency,
      usdPrice: periodPricing.usd_equivalent,
      period: period as 'monthly' | 'yearly' | 'one_time',
      discountPct: periodPricing.discount_pct || 0,
      savingsMessage: periodPricing.savings_message
    }
  } catch (error) {
    console.error('Error getting price data:', error)
    return null
  }
}