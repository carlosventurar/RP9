'use client'

import { useTranslation, useCountry, useCurrency } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  Calculator, 
  Globe, 
  Zap, 
  Shield, 
  TrendingUp,
  ArrowRight,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { CurrencyDisplay } from '@/components/ui/locale-selector'

export default function LocalizedHomePage() {
  const { t } = useTranslation()
  const { countryName, countryConfig } = useCountry()
  const { currency } = useCurrency()

  const features = [
    {
      icon: Bot,
      titleKey: 'features.contact_center.title',
      descriptionKey: 'features.contact_center.description',
      color: 'bg-blue-500/10 text-blue-600'
    },
    {
      icon: Calculator, 
      titleKey: 'features.finance.title',
      descriptionKey: 'features.finance.description',
      color: 'bg-green-500/10 text-green-600'
    },
    {
      icon: Globe,
      titleKey: 'features.integrations.title', 
      descriptionKey: 'features.integrations.description',
      color: 'bg-purple-500/10 text-purple-600'
    }
  ]

  const pricingPlans = [
    {
      name: t('pricing.starter.title', { fallback: 'Starter' }),
      price: t('pricing.starter.price', { fallback: 'Gratis' }),
      description: t('pricing.starter.description', { fallback: 'Perfecto para equipos pequeños' }),
      features: [
        'Hasta 5 usuarios',
        '1,000 ejecuciones/mes',
        '10 workflows activos',
        'Soporte estándar'
      ]
    },
    {
      name: t('pricing.pro.title', { fallback: 'Pro' }),
      price: `$29 USD`,
      description: t('pricing.pro.description', { fallback: 'Para empresas en crecimiento' }),
      features: [
        'Usuarios ilimitados',
        '10,000 ejecuciones/mes', 
        '100 workflows activos',
        'Soporte prioritario'
      ],
      popular: true
    },
    {
      name: t('pricing.enterprise.title', { fallback: 'Enterprise' }),
      price: `$99 USD`,
      description: t('pricing.enterprise.description', { fallback: 'Para grandes organizaciones' }),
      features: [
        'Todo ilimitado',
        'Soporte dedicado 24/7',
        'SLA garantizado',
        'Personalización completa'
      ]
    }
  ]

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <div className="space-y-4">
          <Badge variant="outline" className="px-4 py-2">
            {t('hero.trusted_by', { 
              count: '150+',
              fallback: 'Confiado por 150+ empresas'
            })} en {countryName}
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            {t('hero.title', { fallback: 'Automatización Empresarial Sin Código' })}
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('hero.subtitle', { 
              fallback: 'Transforma procesos manuales en workflows automatizados. Ahorra tiempo, reduce errores y escala tu operación.' 
            })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gap-2">
            {t('hero.cta.primary', { fallback: 'Comenzar Gratis' })}
            <ArrowRight size={16} />
          </Button>
          <Button size="lg" variant="outline">
            {t('hero.cta.secondary', { fallback: 'Ver Demo' })}
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">
            {t('features.title', { fallback: 'Todo lo que Necesitas para Automatizar' })}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('features.subtitle', { fallback: 'Herramientas poderosas y fáciles de usar para transformar tu operación' })}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="border-2 hover:shadow-lg transition-all">
                <CardHeader className="text-center">
                  <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mx-auto mb-4`}>
                    <Icon size={24} />
                  </div>
                  <CardTitle>
                    {t(feature.titleKey, { fallback: feature.titleKey })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    {t(feature.descriptionKey, { fallback: feature.descriptionKey })}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">
            {t('pricing.title', { fallback: 'Precios Transparentes' })}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('pricing.subtitle', { fallback: 'Planes que crecen contigo. Sin costos ocultos.' })}
          </p>
          <p className="text-sm text-muted-foreground">
            Precios en {currency} • {countryConfig.vatRate * 100}% {countryConfig.vatRate > 0.15 ? 'IVA' : 'impuestos'} incluidos
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {pricingPlans.map((plan, index) => (
            <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  Más Popular
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">{plan.price}</div>
                {plan.price !== 'Gratis' && (
                  <p className="text-sm text-muted-foreground">
                    {t('pricing.per_user', { fallback: 'por usuario/mes' })}
                  </p>
                )}
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                  {plan.price === 'Gratis' ? 'Comenzar Ahora' : 'Elegir Plan'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Local Market Information */}
      <section className="bg-muted/50 rounded-lg p-8 space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-4">
            RP9 Portal en {countryName}
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                {countryConfig.currency}
              </div>
              <div className="text-sm text-muted-foreground">
                Facturación local
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                {countryConfig.businessHours}
              </div>
              <div className="text-sm text-muted-foreground">
                Horario de soporte
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                {countryConfig.regulations.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Regulaciones soportadas
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Cumplimos con: {countryConfig.regulations.join(', ')}
          </p>
          <Button asChild>
            <Link href={`/${countryConfig.country.toLowerCase()}/contacto`}>
              Contactar Equipo Local
            </Link>
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center space-y-8 bg-primary/5 rounded-lg p-12">
        <h2 className="text-3xl font-bold">
          ¿Listo para Automatizar tu Operación?
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Únete a las {countryConfig.marketSize === 'large' ? '150+' : '50+'} empresas en {countryName} que ya confían en RP9 Portal.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gap-2">
            <Zap size={16} />
            Comenzar Prueba Gratuita
          </Button>
          <Button size="lg" variant="outline">
            Agendar Demo
          </Button>
        </div>
      </section>
    </div>
  )
}