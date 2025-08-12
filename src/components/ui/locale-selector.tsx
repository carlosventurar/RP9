'use client'

import { useState } from 'react'
import { useLocale, useCountry } from '@/lib/i18n/context'
import { i18nConfig, getCountryConfig } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe, ChevronDown } from 'lucide-react'

const countryFlags: Record<string, string> = {
  'es-MX': '🇲🇽',
  'es-CO': '🇨🇴', 
  'es-CL': '🇨🇱',
  'es-PE': '🇵🇪',
  'es-AR': '🇦🇷',
  'es-DO': '🇩🇴'
}

interface LocaleSelectorProps {
  variant?: 'default' | 'minimal' | 'full'
  showCountryName?: boolean
  showFlag?: boolean
  className?: string
}

export function LocaleSelector({ 
  variant = 'default',
  showCountryName = true,
  showFlag = true,
  className = ''
}: LocaleSelectorProps) {
  const { locale, changeLocale } = useLocale()
  const { countryName } = useCountry()
  const [isOpen, setIsOpen] = useState(false)
  
  const currentConfig = getCountryConfig(locale)
  const currentFlag = countryFlags[locale]

  const handleLocaleChange = (newLocale: string) => {
    changeLocale(newLocale)
    setIsOpen(false)
  }

  if (variant === 'minimal') {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className={`px-2 ${className}`}
          >
            {showFlag && <span className="mr-1">{currentFlag}</span>}
            {currentConfig.country}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {i18nConfig.locales.map((loc) => {
            const config = getCountryConfig(loc)
            const flag = countryFlags[loc]
            
            return (
              <DropdownMenuItem
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className="cursor-pointer flex items-center gap-2"
              >
                <span>{flag}</span>
                <span>{config.countryName}</span>
                {loc === locale && (
                  <span className="ml-auto text-xs text-blue-600">✓</span>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (variant === 'full') {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={`flex items-center gap-2 ${className}`}
          >
            <Globe size={16} />
            {showFlag && <span>{currentFlag}</span>}
            {showCountryName && <span>{countryName}</span>}
            <ChevronDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {i18nConfig.locales.map((loc) => {
            const config = getCountryConfig(loc)
            const flag = countryFlags[loc]
            
            return (
              <DropdownMenuItem
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className="cursor-pointer flex items-center gap-3 p-3"
              >
                <span className="text-lg">{flag}</span>
                <div className="flex-1">
                  <div className="font-medium">{config.countryName}</div>
                  <div className="text-xs text-gray-500">
                    {config.currency} • {config.region}
                  </div>
                </div>
                {loc === locale && (
                  <span className="text-blue-600 font-bold">✓</span>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Default variant
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`flex items-center gap-2 ${className}`}
        >
          {showFlag && <span>{currentFlag}</span>}
          {showCountryName && <span className="hidden sm:inline">{countryName}</span>}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {i18nConfig.locales.map((loc) => {
          const config = getCountryConfig(loc)
          const flag = countryFlags[loc]
          
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className="cursor-pointer flex items-center gap-2"
            >
              <span>{flag}</span>
              <span className="flex-1">{config.countryName}</span>
              <span className="text-xs text-gray-500">{config.currency}</span>
              {loc === locale && (
                <span className="text-blue-600 ml-2">✓</span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Currency display component
export function CurrencyDisplay({ 
  amount, 
  className = '' 
}: { 
  amount: number
  className?: string 
}) {
  const { formatCurrency } = useLocale()
  
  return (
    <span className={className}>
      {formatCurrency(amount)}
    </span>
  )
}

// Date display component
export function DateDisplay({ 
  date, 
  className = '' 
}: { 
  date: Date
  className?: string 
}) {
  const { formatDate } = useLocale()
  
  return (
    <span className={className}>
      {formatDate(date)}
    </span>
  )
}

// Phone display component
export function PhoneDisplay({ 
  phone, 
  className = '' 
}: { 
  phone: string
  className?: string 
}) {
  const { formatPhoneNumber } = useLocale()
  
  return (
    <span className={className}>
      {formatPhoneNumber(phone)}
    </span>
  )
}