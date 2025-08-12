// I18n Translations API
// GET /api/i18n/translations?locale=es-MX

import { NextRequest, NextResponse } from 'next/server'
import { isValidLocale, i18nConfig } from '@/lib/i18n/config'

// Base translations - in production these would come from a database or CMS
const translations: Record<string, Record<string, string>> = {
  'es-MX': {
    // Navigation
    'nav.home': 'Inicio',
    'nav.features': 'Funcionalidades', 
    'nav.pricing': 'Precios',
    'nav.resources': 'Recursos',
    'nav.contact': 'Contacto',
    'nav.login': 'Iniciar Sesión',
    'nav.signup': 'Registrarse',
    'nav.dashboard': 'Panel',
    
    // Common UI
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito', 
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.continue': 'Continuar',
    'common.back': 'Regresar',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.submit': 'Enviar',
    'common.close': 'Cerrar',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.or': 'o',
    'common.and': 'y',
    
    // Hero Section
    'hero.title': 'Automatización Empresarial Sin Código',
    'hero.subtitle': 'Transforma procesos manuales en workflows automatizados. Ahorra tiempo, reduce errores y escala tu operación.',
    'hero.cta.primary': 'Comenzar Gratis',
    'hero.cta.secondary': 'Ver Demo',
    'hero.trusted_by': 'Confiado por {{count}} empresas en México',
    
    // Features
    'features.title': 'Todo lo que Necesitas para Automatizar',
    'features.subtitle': 'Herramientas poderosas y fáciles de usar para transformar tu operación',
    'features.contact_center.title': 'Contact Center Inteligente',
    'features.contact_center.description': 'Automatiza ticket routing, responses y escalamiento. Mejora CSAT y reduce tiempo de respuesta.',
    'features.finance.title': 'Finanzas Automatizadas', 
    'features.finance.description': 'Reconciliaciones automáticas, compliance y reportes. Reduce errores y acelera el cierre mensual.',
    'features.integrations.title': '500+ Integraciones',
    'features.integrations.description': 'Conecta con tus herramientas existentes. APIs, webhooks y conectores pre-construidos.',
    
    // Pricing
    'pricing.title': 'Precios Transparentes',
    'pricing.subtitle': 'Planes que crecen contigo. Sin costos ocultos.',
    'pricing.starter.title': 'Starter',
    'pricing.starter.price': 'Gratis',
    'pricing.starter.description': 'Perfecto para equipos pequeños',
    'pricing.pro.title': 'Pro',
    'pricing.pro.price': '$29 USD',
    'pricing.pro.description': 'Para empresas en crecimiento',
    'pricing.enterprise.title': 'Enterprise',
    'pricing.enterprise.price': '$99 USD',
    'pricing.enterprise.description': 'Para grandes organizaciones',
    'pricing.per_user': 'por usuario/mes',
    'pricing.billed_annually': 'facturado anualmente',
    
    // Forms
    'form.first_name': 'Nombre',
    'form.last_name': 'Apellido',
    'form.email': 'Correo Electrónico',
    'form.phone': 'Teléfono',
    'form.company': 'Empresa',
    'form.job_title': 'Puesto',
    'form.message': 'Mensaje',
    'form.required': 'Requerido',
    'form.invalid_email': 'Correo electrónico inválido',
    'form.submit': 'Enviar',
    
    // Contact
    'contact.title': 'Hablemos de tu Proyecto',
    'contact.subtitle': 'Nuestro equipo está listo para ayudarte a automatizar tu operación',
    'contact.form.title': 'Envíanos un Mensaje',
    'contact.success': 'Mensaje enviado exitosamente. Te contactaremos pronto.',
    'contact.error': 'Error al enviar el mensaje. Intenta de nuevo.',
    
    // Footer
    'footer.product': 'Producto',
    'footer.company': 'Empresa', 
    'footer.resources': 'Recursos',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacidad',
    'footer.terms': 'Términos',
    'footer.cookies': 'Cookies',
    'footer.copyright': '© 2024 RP9 Portal México. Todos los derechos reservados.',
    
    // Dashboard
    'dashboard.welcome': 'Bienvenido, {{name}}',
    'dashboard.overview': 'Resumen',
    'dashboard.workflows': 'Workflows',
    'dashboard.analytics': 'Analítica',
    'dashboard.settings': 'Configuración',
    
    // Workflows
    'workflows.title': 'Mis Workflows',
    'workflows.create': 'Crear Workflow',
    'workflows.empty': 'No tienes workflows todavía',
    'workflows.status.active': 'Activo',
    'workflows.status.inactive': 'Inactivo',
    'workflows.status.draft': 'Borrador',
    
    // Errors
    'error.general': 'Ha ocurrido un error inesperado',
    'error.network': 'Error de conexión. Verifica tu internet.',
    'error.unauthorized': 'No tienes permisos para esta acción',
    'error.not_found': 'Página no encontrada',
    'error.validation': 'Por favor corrige los errores en el formulario'
  },
  
  'es-CO': {
    // Use Mexican Spanish as base but with Colombian variations
    'nav.home': 'Inicio',
    'nav.features': 'Características',
    'nav.pricing': 'Precios', 
    'nav.resources': 'Recursos',
    'nav.contact': 'Contacto',
    'nav.login': 'Iniciar Sesión',
    'nav.signup': 'Registrarse',
    
    'hero.title': 'Automatización Empresarial Sin Código',
    'hero.subtitle': 'Optimice procesos manuales con workflows automatizados. Ahorre tiempo, reduzca errores y escale su operación.',
    'hero.trusted_by': 'Confiado por {{count}} empresas en Colombia',
    
    'footer.copyright': '© 2024 RP9 Portal Colombia. Todos los derechos reservados.',
    
    // Colombian specific terms
    'form.phone': 'Celular',
    'contact.subtitle': 'Nuestro equipo está listo para ayudarle a automatizar su operación'
  },
  
  'es-CL': {
    'nav.home': 'Inicio',
    'nav.features': 'Funcionalidades',
    'nav.pricing': 'Precios',
    'nav.resources': 'Recursos',
    'nav.contact': 'Contacto',
    
    'hero.title': 'Automatización Empresarial Sin Código',
    'hero.subtitle': 'Transforme procesos manuales en flujos automatizados. Lidere la innovación en su industria.',
    'hero.trusted_by': 'Confiado por {{count}} empresas en Chile',
    
    'footer.copyright': '© 2024 RP9 Portal Chile. Todos los derechos reservados.',
    
    // Chilean specific terms
    'common.success': 'Exitoso',
    'pricing.pro.price': '$29 USD',
    'contact.subtitle': 'Nuestro equipo está preparado para ayudarle a liderar la transformación digital'
  },
  
  'es-PE': {
    'nav.home': 'Inicio', 
    'nav.features': 'Características',
    'nav.pricing': 'Precios',
    'nav.resources': 'Recursos',
    'nav.contact': 'Contacto',
    
    'hero.title': 'Automatización Empresarial Sin Código',
    'hero.subtitle': 'Automatice procesos manteniendo el cumplimiento normativo. Optimice operaciones con seguridad.',
    'hero.trusted_by': 'Confiado por {{count}} empresas en Perú',
    
    'footer.copyright': '© 2024 RP9 Portal Perú. Todos los derechos reservados.',
    
    // Peruvian specific terms
    'features.finance.description': 'Reconciliaciones automáticas, cumplimiento SUNAT y reportes. Reduce errores y acelera procesos.'
  },
  
  'es-AR': {
    'nav.home': 'Inicio',
    'nav.features': 'Funcionalidades', 
    'nav.pricing': 'Precios',
    'nav.resources': 'Recursos',
    'nav.contact': 'Contacto',
    
    'hero.title': 'Automatización Empresarial Sin Código',
    'hero.subtitle': 'Transformá procesos manuales en workflows automatizados. Potenciá tu empresa con tecnología de clase mundial.',
    'hero.trusted_by': 'Confiado por {{count}} empresas en Argentina',
    
    'footer.copyright': '© 2024 RP9 Portal Argentina. Todos los derechos reservados.',
    
    // Argentine specific terms (vos forms)
    'hero.cta.primary': 'Comenzá Gratis',
    'hero.cta.secondary': 'Ver Demo',
    'contact.subtitle': 'Nuestro equipo está listo para ayudarte a potenciar tu operación'
  },
  
  'es-DO': {
    'nav.home': 'Inicio',
    'nav.features': 'Características',
    'nav.pricing': 'Precios', 
    'nav.resources': 'Recursos',
    'nav.contact': 'Contacto',
    
    'hero.title': 'Automatización Empresarial Sin Código',
    'hero.subtitle': 'Optimice procesos manuales con workflows automatizados. Mejore la eficiencia de su empresa.',
    'hero.trusted_by': 'Confiado por {{count}} empresas en República Dominicana',
    
    'footer.copyright': '© 2024 RP9 Portal República Dominicana. Todos los derechos reservados.',
    
    // Dominican specific terms
    'contact.subtitle': 'Nuestro equipo está preparado para ayudarle a optimizar su operación'
  }
}

// Merge base translations with locale-specific ones
function getTranslationsForLocale(locale: string): Record<string, string> {
  const baseTranslations = translations['es-MX'] // Use Mexican Spanish as base
  const localeTranslations = translations[locale] || {}
  
  return {
    ...baseTranslations,
    ...localeTranslations
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale')
    
    if (!locale || !isValidLocale(locale)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or missing locale parameter',
          supportedLocales: i18nConfig.locales
        },
        { status: 400 }
      )
    }
    
    const localeTranslations = getTranslationsForLocale(locale)
    
    return NextResponse.json(localeTranslations, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', // Cache for 1 hour
        'Content-Type': 'application/json'
      }
    })
    
  } catch (error) {
    console.error('Translation API error:', error)
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}