'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export default function LocalizedHomePage() {
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    // Redirect to dashboard for authenticated users or login for non-authenticated
    router.replace(`/app/dashboard`)
  }, [router, locale])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}