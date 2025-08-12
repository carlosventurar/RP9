export const locales = ['es', 'es-MX', 'es-CO', 'es-CL', 'es-PE', 'es-AR', 'es-DO', 'en'] as const
export type Locale = typeof locales[number]

export const defaultLocale: Locale = 'es'

export const localeLabels: Record<Locale, string> = {
  es: 'Español',
  'es-MX': 'Español (México)',
  'es-CO': 'Español (Colombia)',
  'es-CL': 'Español (Chile)',
  'es-PE': 'Español (Perú)',
  'es-AR': 'Español (Argentina)',
  'es-DO': 'Español (República Dominicana)',
  en: 'English'
}

export const localeFlags: Record<Locale, string> = {
  es: '🇪🇸',
  'es-MX': '🇲🇽',
  'es-CO': '🇨🇴',
  'es-CL': '🇨🇱',
  'es-PE': '🇵🇪',
  'es-AR': '🇦🇷',
  'es-DO': '🇩🇴',
  en: '🇺🇸'
}