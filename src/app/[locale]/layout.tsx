import { notFound } from 'next/navigation'
import { isValidLocale, getSeoConfig } from '@/lib/i18n/config'
import type { Metadata } from 'next'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params
  
  if (!isValidLocale(locale)) {
    return {
      title: 'RP9 Portal',
      description: 'Automatización empresarial sin código'
    }
  }

  const seoConfig = getSeoConfig(locale)
  
  return {
    title: `RP9 Portal ${seoConfig.titleSuffix}`,
    description: seoConfig.defaultDescription,
    keywords: seoConfig.keywords,
    openGraph: {
      title: `RP9 Portal ${seoConfig.titleSuffix}`,
      description: seoConfig.defaultDescription,
      locale: seoConfig.hreflangCode,
      type: 'website',
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'es-MX': '/es-MX',
        'es-CO': '/es-CO', 
        'es-CL': '/es-CL',
        'es-PE': '/es-PE',
        'es-AR': '/es-AR',
        'es-DO': '/es-DO',
      }
    }
  }
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params

  // Validate locale
  if (!isValidLocale(locale)) {
    notFound()
  }

  return (
    <>
      {children}
    </>
  )
}

export function generateStaticParams() {
  return [
    { locale: 'es-MX' },
    { locale: 'es-CO' },
    { locale: 'es-CL' },
    { locale: 'es-PE' },
    { locale: 'es-AR' },
    { locale: 'es-DO' },
  ]
}