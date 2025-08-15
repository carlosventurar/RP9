'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
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
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  
  const currentConfig = getCountryConfig(locale)
  const currentFlag = countryFlags[locale]

  const handleLocaleChange = (newLocale: string) => {
    // Set cookie
    document.cookie = `agentevirtualia-locale=${newLocale}; max-age=${60 * 60 * 24 * 365}; path=/`
    
    // Navigate to new locale path
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
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

  // Default variant (simplified)
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`flex items-center gap-2 ${className}`}
        >
          {showFlag && <span>{currentFlag}</span>}
          {showCountryName && <span className="hidden sm:inline">{currentConfig.countryName}</span>}
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