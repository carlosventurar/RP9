'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()

  useEffect(() => {
    // Redirect to auth page preserving search params
    const redirect = searchParams.get('redirect')
    const authUrl = redirect 
      ? `/${locale}/auth?redirect=${encodeURIComponent(redirect)}`
      : `/${locale}/auth`
    
    router.replace(authUrl)
  }, [router, locale, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    </div>
  )
}