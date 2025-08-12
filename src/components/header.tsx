"use client"

import * as React from "react"
import { Moon, Sun, Search } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from "@/components/ui/button"
import {
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { LocaleSelector } from "@/components/ui/locale-selector"

export function Header() {
  const { setTheme, theme } = useTheme()
  const t = useTranslations('nav')
  const router = useRouter()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">RP9 Portal</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/search')}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">{t('search')}</span>
          </Button>
          <LocaleSelector variant="minimal" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}