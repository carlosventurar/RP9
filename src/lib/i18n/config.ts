// Internationalization Configuration for Agente Virtual IA
// Supports 6 countries in Latin America

export const i18nConfig = {
  defaultLocale: 'es-419', // Spanish Latin America como estándar ISO
  locales: ['es-419', 'es-MX', 'es-CO', 'es-CL', 'es-PE', 'es-AR', 'es-DO', 'en-US'],
  fallbackLocale: 'es-419',
  countryAliases: {
    '/mx': 'es-MX',
    '/co': 'es-CO', 
    '/cl': 'es-CL',
    '/pe': 'es-PE',
    '/ar': 'es-AR',
    '/do': 'es-DO',
    '/us': 'en-US'
  }
}

// Country-specific configurations
export const countryConfigs = {
  'es-419': {
    country: 'LATAM',
    countryName: 'América Latina',
    currency: 'USD', // Fallback a USD para neutralidad
    currencySymbol: '$',
    timezone: 'America/Mexico_City', // Central timezone para LatAm
    phoneCode: '+',
    businessHours: '9:00 - 18:00',
    regulations: ['General'],
    languages: ['Español'],
    region: 'Latin America',
    vatRate: 0.0, // Neutro
    domains: ['rp9.io'],
    paymentMethods: ['stripe'],
    bankingPartners: [],
    localPartners: [],
    marketSize: 'region',
    gdpPerCapita: 8000,
    businessCulture: {
      formalityLevel: 'medium',
      decisionMakingSpeed: 'medium',
      hierarchical: true,
      relationshipImportance: 'high'
    }
  },
  'en-US': {
    country: 'US',
    countryName: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    timezone: 'America/New_York',
    phoneCode: '+1',
    businessHours: '9:00 - 17:00 EST',
    regulations: ['SEC', 'SOX', 'GDPR'],
    languages: ['English'],
    region: 'North America', 
    vatRate: 0.0, // Sales tax varies by state
    domains: ['agentevirtualia.com'],
    paymentMethods: ['stripe', 'paypal'],
    bankingPartners: ['JPMorgan Chase', 'Bank of America', 'Wells Fargo'],
    localPartners: ['Salesforce', 'HubSpot', 'Zapier'],
    marketSize: 'large',
    gdpPerCapita: 65000,
    businessCulture: {
      formalityLevel: 'low',
      decisionMakingSpeed: 'fast',
      hierarchical: false,
      relationshipImportance: 'medium'
    }
  },
  'es-MX': {
    country: 'MX',
    countryName: 'México',
    currency: 'MXN',
    currencySymbol: '$',
    timezone: 'America/Mexico_City',
    phoneCode: '+52',
    businessHours: '9:00 - 18:00 CST',
    regulations: ['SAT', 'IMSS', 'INFONAVIT', 'CNBV'],
    languages: ['Español'],
    region: 'North America',
    vatRate: 0.16, // IVA 16%
    domains: ['agentevirtualia.mx'],
    paymentMethods: ['stripe', 'conekta', 'mercadopago'],
    bankingPartners: ['Banorte', 'BBVA México', 'Santander México'],
    localPartners: ['Konfío', 'Clip', 'Bitso'],
    marketSize: 'large',
    gdpPerCapita: 10000,
    businessCulture: {
      formalityLevel: 'medium',
      decisionMakingSpeed: 'medium',
      hierarchical: true,
      relationshipImportance: 'high'
    }
  },
  'es-CO': {
    country: 'CO',
    countryName: 'Colombia',
    currency: 'COP',
    currencySymbol: '$',
    timezone: 'America/Bogota',
    phoneCode: '+57',
    businessHours: '8:00 - 17:00 COT',
    regulations: ['DIAN', 'Supersociedades', 'SFC', 'CNBV'],
    languages: ['Español'],
    region: 'South America',
    vatRate: 0.19, // IVA 19%
    domains: ['agentevirtualia.com.co'],
    paymentMethods: ['stripe', 'mercadopago', 'payu'],
    bankingPartners: ['Bancolombia', 'Banco de Bogotá', 'Davivienda'],
    localPartners: ['Rappi', 'Platzi', 'Mesfix'],
    marketSize: 'medium',
    gdpPerCapita: 6400,
    businessCulture: {
      formalityLevel: 'medium',
      decisionMakingSpeed: 'medium',
      hierarchical: true,
      relationshipImportance: 'high'
    }
  },
  'es-CL': {
    country: 'CL',
    countryName: 'Chile',
    currency: 'CLP',
    currencySymbol: '$',
    timezone: 'America/Santiago',
    phoneCode: '+56',
    businessHours: '9:00 - 18:00 CLT',
    regulations: ['SII', 'CMF', 'SBIF'],
    languages: ['Español'],
    region: 'South America',
    vatRate: 0.19, // IVA 19%
    domains: ['agentevirtualia.cl'],
    paymentMethods: ['stripe', 'mercadopago', 'webpay'],
    bankingPartners: ['Banco de Chile', 'Santander Chile', 'BCI'],
    localPartners: ['NotCo', 'Cornershop', 'Buk'],
    marketSize: 'medium',
    gdpPerCapita: 15000,
    businessCulture: {
      formalityLevel: 'high',
      decisionMakingSpeed: 'fast',
      hierarchical: false,
      relationshipImportance: 'medium'
    }
  },
  'es-PE': {
    country: 'PE',
    countryName: 'Perú',
    currency: 'PEN',
    currencySymbol: 'S/',
    timezone: 'America/Lima',
    phoneCode: '+51',
    businessHours: '9:00 - 18:00 PET',
    regulations: ['SUNAT', 'SBS', 'OSCE'],
    languages: ['Español', 'Quechua'],
    region: 'South America',
    vatRate: 0.18, // IGV 18%
    domains: ['agentevirtualia.pe'],
    paymentMethods: ['stripe', 'mercadopago', 'culqi'],
    bankingPartners: ['BCP', 'Interbank', 'BBVA Perú'],
    localPartners: ['Rappi', 'Platanitos', 'Crehana'],
    marketSize: 'medium',
    gdpPerCapita: 7000,
    businessCulture: {
      formalityLevel: 'high',
      decisionMakingSpeed: 'slow',
      hierarchical: true,
      relationshipImportance: 'high'
    }
  },
  'es-AR': {
    country: 'AR',
    countryName: 'Argentina',
    currency: 'ARS',
    currencySymbol: '$',
    timezone: 'America/Argentina/Buenos_Aires',
    phoneCode: '+54',
    businessHours: '9:00 - 18:00 ART',
    regulations: ['AFIP', 'BCRA', 'CNV', 'ENACOM'],
    languages: ['Español'],
    region: 'South America',
    vatRate: 0.21, // IVA 21%
    domains: ['agentevirtualia.com.ar'],
    paymentMethods: ['stripe', 'mercadopago', 'decidir'],
    bankingPartners: ['Banco Nación', 'Santander Argentina', 'BBVA Argentina'],
    localPartners: ['MercadoLibre', 'Globant', 'Auth0'],
    marketSize: 'large',
    gdpPerCapita: 10000,
    businessCulture: {
      formalityLevel: 'medium',
      decisionMakingSpeed: 'slow',
      hierarchical: true,
      relationshipImportance: 'very_high'
    }
  },
  'es-DO': {
    country: 'DO',
    countryName: 'República Dominicana',
    currency: 'DOP',
    currencySymbol: 'RD$',
    timezone: 'America/Santo_Domingo',
    phoneCode: '+1-809',
    businessHours: '8:00 - 17:00 AST',
    regulations: ['DGII', 'SIB', 'CNBV', 'INDOCAL'],
    languages: ['Español'],
    region: 'Caribbean',
    vatRate: 0.18, // ITBIS 18%
    domains: ['agentevirtualia.com.do'],
    paymentMethods: ['stripe', 'mercadopago', 'azul'],
    bankingPartners: ['Banco Popular', 'Banreservas', 'Scotiabank'],
    localPartners: ['Claro', 'Altice', 'Grupo SID'],
    marketSize: 'small',
    gdpPerCapita: 8500,
    businessCulture: {
      formalityLevel: 'medium',
      decisionMakingSpeed: 'medium',
      hierarchical: true,
      relationshipImportance: 'high'
    }
  }
}

// Date and number formatting configurations
export const formatConfigs = {
  'es-MX': {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: '1,234.56',
    currencyFormat: '$1,234.56 MXN'
  },
  'es-CO': {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: '1.234,56',
    currencyFormat: '$1.234,56 COP'
  },
  'es-CL': {
    dateFormat: 'dd-MM-yyyy',
    timeFormat: 'HH:mm',
    numberFormat: '1.234,56',
    currencyFormat: '$1.234,56 CLP'
  },
  'es-PE': {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: '1,234.56',
    currencyFormat: 'S/1,234.56'
  },
  'es-AR': {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: '1.234,56',
    currencyFormat: '$1.234,56 ARS'
  },
  'es-DO': {
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: '1,234.56',
    currencyFormat: 'RD$1,234.56'
  }
}

// Legal and compliance configurations
export const legalConfigs = {
  'es-MX': {
    privacyLaw: 'LFPDPPP',
    dataRetention: 5, // years
    cookieConsent: true,
    gdprApplicable: false,
    termsTemplate: 'mx-terms',
    privacyTemplate: 'mx-privacy'
  },
  'es-CO': {
    privacyLaw: 'Ley 1581',
    dataRetention: 3,
    cookieConsent: true,
    gdprApplicable: false,
    termsTemplate: 'co-terms',
    privacyTemplate: 'co-privacy'
  },
  'es-CL': {
    privacyLaw: 'Ley 19.628',
    dataRetention: 5,
    cookieConsent: true,
    gdprApplicable: false,
    termsTemplate: 'cl-terms',
    privacyTemplate: 'cl-privacy'
  },
  'es-PE': {
    privacyLaw: 'Ley 29733',
    dataRetention: 4,
    cookieConsent: true,
    gdprApplicable: false,
    termsTemplate: 'pe-terms',
    privacyTemplate: 'pe-privacy'
  },
  'es-AR': {
    privacyLaw: 'Ley 25.326',
    dataRetention: 5,
    cookieConsent: true,
    gdprApplicable: false,
    termsTemplate: 'ar-terms',
    privacyTemplate: 'ar-privacy'
  },
  'es-DO': {
    privacyLaw: 'Ley 172-13',
    dataRetention: 3,
    cookieConsent: true,
    gdprApplicable: false,
    termsTemplate: 'do-terms',
    privacyTemplate: 'do-privacy'
  }
}

// Marketing and sales configurations
export const marketingConfigs = {
  'es-MX': {
    priceAnchor: 'usd', // Show USD prices prominently
    localCompetitors: ['Zapier México', 'Microsoft Power Platform', 'Nintex'],
    successStoryFocus: 'cost_savings',
    primaryChannels: ['google_ads', 'linkedin', 'webinars'],
    testimonialStyle: 'formal',
    caseStudyIndustries: ['fintech', 'retail', 'manufacturing'],
    localEvents: ['Expo Manufactura', 'eCommerce MX', 'Fintech México']
  },
  'es-CO': {
    priceAnchor: 'usd',
    localCompetitors: ['Microsoft Power Platform', 'Nintex', 'UiPath'],
    successStoryFocus: 'efficiency_gains',
    primaryChannels: ['google_ads', 'linkedin', 'partnerships'],
    testimonialStyle: 'conversational',
    caseStudyIndustries: ['fintech', 'logistics', 'services'],
    localEvents: ['Colombia 4.0', 'eCommerce Day', 'Fintech Americas']
  },
  'es-CL': {
    priceAnchor: 'usd',
    localCompetitors: ['Microsoft Power Platform', 'Nintex', 'K2'],
    successStoryFocus: 'innovation_leadership',
    primaryChannels: ['linkedin', 'industry_events', 'referrals'],
    testimonialStyle: 'professional',
    caseStudyIndustries: ['mining', 'fintech', 'retail'],
    localEvents: ['EXPONOR', 'eCommerce Day Chile', 'Digital Innovation Summit']
  },
  'es-PE': {
    priceAnchor: 'local', // Show local currency more prominently
    localCompetitors: ['Microsoft Power Platform', 'Nintex'],
    successStoryFocus: 'compliance_automation',
    primaryChannels: ['google_ads', 'webinars', 'partnerships'],
    testimonialStyle: 'formal',
    caseStudyIndustries: ['mining', 'finance', 'government'],
    localEvents: ['CADE', 'Expomina', 'Peru Digital']
  },
  'es-AR': {
    priceAnchor: 'usd',
    localCompetitors: ['Microsoft Power Platform', 'Nintex', 'Globant'],
    successStoryFocus: 'business_transformation',
    primaryChannels: ['linkedin', 'content_marketing', 'events'],
    testimonialStyle: 'enthusiastic',
    caseStudyIndustries: ['fintech', 'agtech', 'services'],
    localEvents: ['IDEA', 'eCommerce Day', 'Fintech Argentina']
  },
  'es-DO': {
    priceAnchor: 'usd',
    localCompetitors: ['Microsoft Power Platform'],
    successStoryFocus: 'operational_excellence',
    primaryChannels: ['google_ads', 'partnerships', 'referrals'],
    testimonialStyle: 'warm',
    caseStudyIndustries: ['tourism', 'finance', 'logistics'],
    localEvents: ['ADOEXPO', 'Tech Summit DR', 'Caribbean Tech Conference']
  }
}

// Utility functions
export function getCountryConfig(locale: string) {
  // Some locales like 'es' (generic) may not have a country config; fallback to default country (es-MX)
  const cfg = countryConfigs[locale as keyof typeof countryConfigs]
  if (cfg) return cfg
  // Fallback to a sensible default for Spanish
  return countryConfigs['es-MX']
}

export function getFormatConfig(locale: string) {
  return formatConfigs[locale as keyof typeof formatConfigs]
}

export function getLegalConfig(locale: string) {
  return legalConfigs[locale as keyof typeof legalConfigs]
}

export function getMarketingConfig(locale: string) {
  return marketingConfigs[locale as keyof typeof marketingConfigs]
}

export function detectLocaleFromDomain(hostname: string): string {
  // Extract country code from domain
  if (hostname.includes('.mx')) return 'es-MX'
  if (hostname.includes('.co')) return 'es-CO'
  if (hostname.includes('.cl')) return 'es-CL'
  if (hostname.includes('.pe')) return 'es-PE'
  if (hostname.includes('.ar')) return 'es-AR'
  if (hostname.includes('.do')) return 'es-DO'
  
  return i18nConfig.defaultLocale
}

export function formatCurrency(amount: number, locale: string): string {
  const config = getCountryConfig(locale)
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
  
  return formatter.format(amount)
}

export function formatDate(date: Date, locale: string): string {
  const config = getFormatConfig(locale)
  return new Intl.DateTimeFormat(locale).format(date)
}

export function formatPhoneNumber(phone: string, locale: string): string {
  const config = getCountryConfig(locale)
  // Simple formatting - could be enhanced with libphonenumber
  if (!phone.startsWith('+')) {
    return `${config.phoneCode} ${phone}`
  }
  return phone
}

// Validation functions
export function isValidLocale(locale: string): boolean {
  return i18nConfig.locales.includes(locale)
}

export function getSupportedCountries(): string[] {
  return Object.values(countryConfigs).map(config => config.country)
}

// SEO and content configurations
export const seoConfigs = {
  'es-MX': {
    titleSuffix: '- Agente Virtual IA México',
    defaultDescription: 'Automatización empresarial sin código. Ahorra tiempo y reduce errores con workflows inteligentes.',
    keywords: ['automatización', 'workflows', 'productividad', 'México', 'enterprise'],
    hreflangCode: 'es-MX'
  },
  'es-CO': {
    titleSuffix: '- Agente Virtual IA Colombia',
    defaultDescription: 'Automatización empresarial para Colombia. Mejora la eficiencia de tu empresa con procesos automatizados.',
    keywords: ['automatización', 'procesos', 'eficiencia', 'Colombia', 'empresa'],
    hreflangCode: 'es-CO'
  },
  'es-CL': {
    titleSuffix: '- Agente Virtual IA Chile',
    defaultDescription: 'Lidera la transformación digital en Chile. Automatización empresarial de clase mundial.',
    keywords: ['transformación digital', 'automatización', 'innovación', 'Chile', 'empresa'],
    hreflangCode: 'es-CL'
  },
  'es-PE': {
    titleSuffix: '- Agente Virtual IA Perú',
    defaultDescription: 'Automatización empresarial para Perú. Cumple con regulaciones locales mientras optimizas procesos.',
    keywords: ['automatización', 'compliance', 'procesos', 'Perú', 'empresa'],
    hreflangCode: 'es-PE'
  },
  'es-AR': {
    titleSuffix: '- Agente Virtual IA Argentina',
    defaultDescription: 'Transformación digital para Argentina. Automatiza procesos y mejora la productividad empresarial.',
    keywords: ['transformación digital', 'automatización', 'Argentina', 'productividad'],
    hreflangCode: 'es-AR'
  },
  'es-DO': {
    titleSuffix: '- Agente Virtual IA República Dominicana',
    defaultDescription: 'Automatización empresarial en República Dominicana. Optimiza procesos y mejora la eficiencia.',
    keywords: ['automatización', 'eficiencia', 'República Dominicana', 'procesos'],
    hreflangCode: 'es-DO'
  }
}

export function getSeoConfig(locale: string) {
  return seoConfigs[locale as keyof typeof seoConfigs]
}