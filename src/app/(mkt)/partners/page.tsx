import { Metadata } from 'next'
import { Star, Users, Shield, Award, ArrowRight, CheckCircle2, Trophy, Handshake, DollarSign, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Partners - Agente Virtual IA',
  description: 'Únete al programa de partners de RP9. Genera ingresos recurrentes ayudando a empresas a automatizar sus procesos.',
}

const partnerTiers = [
  {
    id: 'silver',
    name: 'Silver Partner',
    level: 'Básico',
    requirements: [
      '1 cliente referido exitoso',
      'Certificación básica RP9',
      'Disponibilidad 20h/mes'
    ],
    benefits: [
      '15% comisión recurrente',
      'Acceso a recursos básicos',
      'Support estándar',
      'Badge de partner'
    ],
    commission: '15%',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200'
  },
  {
    id: 'gold',
    name: 'Gold Partner',
    level: 'Avanzado',
    requirements: [
      '5+ clientes referidos exitosos',
      'Certificación avanzada RP9',
      'Disponibilidad 40h/mes',
      '3+ meses como Silver'
    ],
    benefits: [
      '25% comisión recurrente',
      'Co-marketing opportunities',
      'Priority support',
      'Acceso a beta features',
      'Partner portal avanzado',
      'Training exclusivo'
    ],
    commission: '25%',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    popular: true
  }
]

const partnerTypes = [
  {
    type: 'Consultores',
    icon: '👨‍💼',
    description: 'Consultores de automatización y procesos que buscan ampliar su oferta de servicios',
    benefits: [
      'Revenue adicional recurrente',
      'Diferenciación competitiva',
      'Recursos de implementación',
      'Soporte técnico dedicado'
    ],
    examples: [
      'Consultores de gestión',
      'System integrators',
      'Business analysts',
      'Process improvement experts'
    ]
  },
  {
    type: 'Agencias',
    icon: '🏢',
    description: 'Agencias digitales y de marketing que quieren ofrecer automatización a sus clientes',
    benefits: [
      'Expand service portfolio',
      'Higher value engagements',
      'Long-term client retention',
      'White-label options'
    ],
    examples: [
      'Digital agencies',
      'Marketing agencies',
      'Web development firms',
      'E-commerce specialists'
    ]
  },
  {
    type: 'Freelancers',
    icon: '💻',
    description: 'Profesionales independientes especializados en automatización y integrations',
    benefits: [
      'Stable recurring income',
      'Project scalability',
      'Professional certification',
      'Network growth'
    ],
    examples: [
      'Automation specialists',
      'Integration developers',
      'Workflow consultants',
      'No-code experts'
    ]
  },
  {
    type: 'Resellers',
    icon: '🤝',
    description: 'Distribuidores y revendedores que buscan soluciones de automatización',
    benefits: [
      'Attractive margins',
      'Market differentiation',
      'Sales support',
      'Training programs'
    ],
    examples: [
      'Technology resellers',
      'Software distributors',
      'Business solution providers',
      'Channel partners'
    ]
  }
]

const successStories = [
  {
    partner: 'AutoFlow Consulting',
    type: 'Gold Partner',
    results: {
      clients: 23,
      revenue: '$45,000',
      timeframe: '8 meses'
    },
    quote: "RP9 nos permitió expandir nuestros servicios y generar $45k en revenue adicional. Los clientes aman la automatización.",
    name: 'Carlos Rodriguez',
    role: 'Founder'
  },
  {
    partner: 'Digital Boost Agency',
    type: 'Gold Partner',
    results: {
      clients: 31,
      revenue: '$67,000',
      timeframe: '12 meses'
    },
    quote: "Nuestros clientes ahora nos ven como partners estratégicos, no solo como una agencia más. ROI increíble.",
    name: 'Maria Santos',
    role: 'CEO'
  }
]

const referralProcess = [
  {
    step: 1,
    title: 'Identifica Oportunidad',
    description: 'Encuentra empresas con procesos manuales que podrían automatizar',
    icon: '🎯'
  },
  {
    step: 2,
    title: 'Hace la Referencia',
    description: 'Presenta RP9 y conecta al prospecto con nuestro equipo de ventas',
    icon: '🤝'
  },
  {
    step: 3,
    title: 'Apoyamos la Venta',
    description: 'Nuestro equipo maneja todo el proceso de venta y cierre',
    icon: '💼'
  },
  {
    step: 4,
    title: 'Ganas Comisión',
    description: 'Recibe comisión recurrente mensual mientras el cliente permanezca activo',
    icon: '💰'
  }
]

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">
            <Handshake className="w-4 h-4 mr-2" />
            Programa de Partners
          </Badge>
          <h1 className="text-4xl font-bold mb-6">
            Genera Ingresos{' '}
            <span className="text-primary">Recurrentes</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Únete a nuestro programa de partners y ayuda a empresas a automatizar sus procesos
            mientras construyes un negocio rentable y sostenible.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto mb-8">
            <Button size="lg" className="flex-1">
              Aplicar Ahora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="flex-1">
              Ver Programa
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Sin costo de entrada
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Comisiones hasta 25%
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Soporte completo
            </div>
          </div>
        </div>
      </section>

      {/* Partner Tiers */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Niveles de Partnership</h2>
            <p className="text-muted-foreground">
              Crece con nosotros y desbloquea mejores beneficios
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {partnerTiers.map((tier) => (
              <Card key={tier.id} className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : tier.borderColor}`}>
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1">
                      <Star className="h-3 w-3 mr-1" />
                      Más Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className={`text-center ${tier.bgColor} rounded-t-lg`}>
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${tier.bgColor} border-2 ${tier.borderColor} flex items-center justify-center`}>
                    <Trophy className={`w-8 h-8 ${tier.color}`} />
                  </div>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-base">{tier.level}</CardDescription>
                  <div className="text-3xl font-bold text-primary mt-2">
                    {tier.commission}
                  </div>
                  <div className="text-sm text-muted-foreground">comisión recurrente</div>
                </CardHeader>
                
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-red-600">Requisitos</h4>
                      <ul className="space-y-2">
                        {tier.requirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-3 text-green-600">Beneficios</h4>
                      <ul className="space-y-2">
                        {tier.benefits.map((benefit, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full mt-6"
                    variant={tier.popular ? 'default' : 'outline'}
                  >
                    {tier.id === 'silver' ? 'Empezar Como Silver' : 'Aplicar Para Gold'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Types */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">¿Quién Puede Ser Partner?</h2>
            <p className="text-muted-foreground">
              Nuestro programa está diseñado para diferentes tipos de profesionales
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {partnerTypes.map((type, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{type.icon}</span>
                    <div>
                      <CardTitle className="text-xl">{type.type}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-sm leading-relaxed">
                    {type.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-green-600">Beneficios Clave</h4>
                      <ul className="space-y-1">
                        {type.benefits.map((benefit, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2 text-blue-600">Perfiles Ideales</h4>
                      <div className="flex flex-wrap gap-2">
                        {type.examples.map((example, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {example}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Casos de Éxito</h2>
            <p className="text-muted-foreground">
              Partners que han construido negocios exitosos con RP9
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {successStories.map((story, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="bg-primary/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <CardTitle className="text-lg">{story.partner}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {story.type}
                      </Badge>
                    </div>
                    <Trophy className="w-8 h-8 text-primary" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{story.results.clients}</div>
                      <div className="text-xs text-muted-foreground">Clientes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{story.results.revenue}</div>
                      <div className="text-xs text-muted-foreground">Revenue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{story.results.timeframe}</div>
                      <div className="text-xs text-muted-foreground">Tiempo</div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-6">
                  <blockquote className="text-sm italic mb-4 border-l-2 border-primary pl-4">
                    "{story.quote}"
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{story.name}</div>
                      <div className="text-xs text-muted-foreground">{story.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Referral Process */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Proceso Simple</h2>
            <p className="text-muted-foreground">
              En 4 pasos simples, puedes empezar a generar ingresos recurrentes
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {referralProcess.map((step, index) => (
              <div key={step.step} className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">{step.icon}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    {step.step}
                  </div>
                  {index < referralProcess.length - 1 && (
                    <div className="hidden md:block absolute top-8 -right-6 w-12 h-0.5 bg-muted-foreground/30"></div>
                  )}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <span className="font-semibold">Ejemplo de Ingresos</span>
              </div>
              <div className="text-2xl font-bold text-primary mb-2">$3,750/mes</div>
              <div className="text-sm text-muted-foreground">
                5 clientes × $300 MRR × 25% comisión
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            ¿Listo para Empezar?
          </h2>
          <p className="text-lg mb-8 text-primary-foreground/90 max-w-2xl mx-auto">
            Aplica a nuestro programa de partners hoy mismo. Proceso de aprobación en 24-48 horas.
            Sin costos de entrada, solo éxito compartido.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto mb-8">
            <Button variant="secondary" size="lg" className="flex-1">
              Aplicar Como Partner
              <Zap className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="flex-1 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
              Programa Detallado
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-sm text-primary-foreground/70">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Aprobación rápida
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Training completo incluido
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Soporte dedicado 24/7
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}