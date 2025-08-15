'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  Calculator, 
  Globe, 
  Zap, 
  ArrowRight,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { getCountryConfig } from '@/lib/i18n/config'

export default function LocalizedHomePage() {
  const t = useTranslations('home')
  const locale = useLocale()
  const countryConfig = getCountryConfig(locale)

  const features = [
    {
      icon: Bot,
      title: t('features.contactCenter.title'),
      description: t('features.contactCenter.description')
    },
    {
      icon: Calculator, 
      title: t('features.finance.title'),
      description: t('features.finance.description')
    },
    {
      icon: Globe,
      title: t('features.integrations.title'),
      description: t('features.integrations.description')
    }
  ]

  const pricingPlans = [
    {
      name: t('pricing.plans.starter.name'),
      price: t('pricing.plans.starter.price'),
      description: t('pricing.plans.starter.description'),
      features: [
        t('pricing.plans.starter.features.users'),
        t('pricing.plans.starter.features.executions'),
        t('pricing.plans.starter.features.workflows'),
        t('pricing.plans.starter.features.support')
      ],
      button: t('pricing.plans.starter.button')
    },
    {
      name: t('pricing.plans.pro.name'),
      price: t('pricing.plans.pro.price'),
      description: t('pricing.plans.pro.description'),
      features: [
        t('pricing.plans.pro.features.users'),
        t('pricing.plans.pro.features.executions'), 
        t('pricing.plans.pro.features.workflows'),
        t('pricing.plans.pro.features.support')
      ],
      popular: true,
      popularText: t('pricing.plans.pro.popular'),
      button: t('pricing.plans.pro.button')
    },
    {
      name: t('pricing.plans.enterprise.name'),
      price: t('pricing.plans.enterprise.price'),
      description: t('pricing.plans.enterprise.description'),
      features: [
        t('pricing.plans.enterprise.features.unlimited'),
        t('pricing.plans.enterprise.features.support'),
        t('pricing.plans.enterprise.features.sla'),
        t('pricing.plans.enterprise.features.customization')
      ],
      button: t('pricing.plans.enterprise.button')
    }
  ]

  return (
    <div className="space-y-16 py-8 px-4 max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <div className="space-y-4">
          <Badge variant="outline" className="px-4 py-2">
            {t('hero.badge')} {countryConfig.countryName}
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            {t('hero.title')}
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('hero.subtitle')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gap-2" asChild>
            <Link href="/login">
              {t('hero.startFree')}
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/contacto">
              {t('hero.viewDemo')}
            </Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">
            {t('features.title')}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="border-2 hover:shadow-lg transition-all">
                <CardHeader className="text-center">
                  <div className={`w-12 h-12 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-4`}>
                    <Icon size={24} />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">{t('pricing.title')}</h2>
          <p className="text-xl text-muted-foreground">
            {t('pricing.subtitle')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('pricing.taxNote', { currency: countryConfig.currency, taxRate: countryConfig.vatRate * 100 })}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {pricingPlans.map((plan, index) => (
            <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  {plan.popularText}
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">{plan.price}</div>
                {plan.price !== 'Gratis' && (
                  <p className="text-sm text-muted-foreground">por usuario/mes</p>
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
                  {plan.button}
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
            {t('localMarket.title', { country: countryConfig.countryName })}
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                {countryConfig.currency}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('localMarket.currency')}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                {countryConfig.businessHours}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('localMarket.support')}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                {countryConfig.regulations.length}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('localMarket.regulations')}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            {t('localMarket.compliance', { regulations: countryConfig.regulations.join(', ') })}
          </p>
          <Button asChild>
            <Link href="/contacto">
              {t('localMarket.contactTeam')}
            </Link>
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center space-y-8 bg-primary/5 rounded-lg p-12">
        <h2 className="text-3xl font-bold">
          {t('cta.title')}
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('cta.subtitle', { 
            count: countryConfig.marketSize === 'large' ? '150+' : '50+',
            country: countryConfig.countryName 
          })}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gap-2" asChild>
            <Link href="/login">
              <Zap size={16} />
              {t('cta.startTrial')}
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/contacto">
              {t('cta.scheduleDemo')}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}