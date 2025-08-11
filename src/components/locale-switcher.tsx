'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe } from 'lucide-react'
import { locales, localeLabels, localeFlags, type Locale } from '@/i18n/config'

interface LocaleSwitcherProps {
  currentLocale: string
}

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const router = useRouter()
  const [isChanging, setIsChanging] = useState(false)

  const handleLocaleChange = async (locale: Locale) => {
    if (locale === currentLocale) return
    
    setIsChanging(true)
    
    // Set locale cookie
    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
    
    // Force a page refresh to apply the new locale
    router.refresh()
    
    setTimeout(() => {
      setIsChanging(false)
    }, 1000)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          disabled={isChanging}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {localeFlags[currentLocale as Locale]} {localeLabels[currentLocale as Locale]}
          </span>
          <span className="sm:hidden">
            {localeFlags[currentLocale as Locale]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={`gap-2 ${
              locale === currentLocale ? 'bg-accent' : ''
            }`}
          >
            <span>{localeFlags[locale]}</span>
            <span>{localeLabels[locale]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}