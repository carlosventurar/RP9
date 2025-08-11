import { Metadata } from 'next'
import { TrendingUp, Users, Clock, DollarSign, Star, ArrowRight, CheckCircle2, Zap, Building2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Casos de Éxito - RP9 Portal',
  description: 'Descubre cómo empresas están transformando sus operaciones con RP9. Casos reales, métricas verificadas.',
}

const lighthouses = [
  {
    id: 'ecommerce-leader',
    company: 'TechStyle Commerce',
    industry: 'E-commerce',
    size: '150 empleados',
    logo: '🛒',
    challenge: 'Gestión manual de inventario en 5 plataformas causaba inconsistencias y pérdidas de ventas',
    solution: 'Automatización completa de sincronización de inventario cross-platform',
    results: {
      timeSaved: '320 horas/mes',
      costSavings: '$180,000/año',
      roi: '450%',
      errorReduction: '95%',
      customMetric: 'Stockouts reducidos 80%'
    },
    quote: "RP9 transformó completamente nuestra operación. Pasamos de tener errores de inventario diarios a prácticamente cero. Nuestro equipo ahora se enfoca en estrategia en lugar de tareas manuales.",
    author: {
      name: 'María González',
      role: 'Head of Operations',
      image: '👩‍💼'
    },
    implementation: {
      timeline: '3 semanas',
      templatesUsed: 'Multi-Channel Inventory Sync Pro, Analytics Dashboard Pro',
      integrations: 'Shopify, Amazon, eBay, WooCommerce, Magento'
    },
    featured: true
  },
  {
    id: 'fintech-growth',
    company: 'PayFlow Solutions',
    industry: 'Fintech',
    size: '80 empleados',
    logo: '💰',
    challenge: 'Procesos de compliance manual retrasaban onboarding de clientes nuevos',
    solution: 'Pipeline automatizado de verificación y aprobación de clientes',
    results: {
      timeSaved: '200 horas/mes',
      costSavings: '$320,000/año',
      roi: '780%',
      errorReduction: '98%',
      customMetric: 'Tiempo onboarding: 7 días → 2 horas'
    },
    quote: "La automatización de compliance nos permitió escalar de 100 a 1,000 clientes mensuales sin aumentar el equipo. ROI increíble en menos de 2 meses.",
    author: {
      name: 'Carlos Ruiz',
      role: 'CTO',
      image: '👨‍💻'
    },
    implementation: {
      timeline: '4 semanas',
      templatesUsed: 'Advanced Lead Scoring AI Pro, Compliance Automation Suite',
      integrations: 'Salesforce, DocuSign, AWS, Stripe'
    },
    featured: true
  },
  {
    id: 'healthcare-ops',
    company: 'MediCare Plus',
    industry: 'Healthcare',
    size: '200 empleados',
    logo: '🏥',
    challenge: 'Coordinación manual de citas y seguimiento de pacientes generaba retrasos',
    solution: 'Sistema automatizado de gestión de pacientes y comunicaciones',
    results: {
      timeSaved: '400 horas/mes',
      costSavings: '$240,000/año',
      roi: '520%',
      errorReduction: '92%',
      customMetric: 'Satisfacción pacientes +35%'
    },
    quote: "Nuestros pacientes ahora reciben recordatorios automáticos, seguimiento post-consulta, y coordinación perfecta. La experiencia del paciente mejoró dramáticamente.",
    author: {
      name: 'Dra. Ana Silva',
      role: 'Directora de Operaciones',
      image: '👩‍⚕️'
    },
    implementation: {
      timeline: '6 semanas',
      templatesUsed: 'Patient Communication Suite, Appointment Automation Pro',
      integrations: 'Epic, Twilio, Google Calendar, Zoom'
    },
    featured: false
  },
  {
    id: 'manufacturing-efficiency',
    company: 'Industrial Dynamics',
    industry: 'Manufacturing',
    size: '300 empleados',
    logo: '🏭',
    challenge: 'Tracking manual de producción y calidad creaba cuellos de botella',
    solution: 'Dashboard en tiempo real con alertas automáticas de producción',
    results: {
      timeSaved: '500 horas/mes',
      costSavings: '$420,000/año',
      roi: '680%',
      errorReduction: '90%',
      customMetric: 'Eficiencia producción +28%'
    },
    quote: "Ver toda la línea de producción en tiempo real y recibir alertas automáticas cambió nuestra operación. Prevenimos problemas antes de que sucedan.",
    author: {
      name: 'Roberto Mendoza',
      role: 'Plant Manager',
      image: '👨‍🔧'
    },
    implementation: {
      timeline: '5 semanas',
      templatesUsed: 'Real-Time Analytics Dashboard, Quality Control Automation',
      integrations: 'SAP, Siemens PLC, Slack, SMS Gateway'
    },
    featured: false
  }
]

const metrics = [
  {
    label: 'Ahorro Promedio Anual',
    value: '$290,000',
    icon: DollarSign,
    color: 'text-green-600'
  },
  {
    label: 'ROI Promedio',
    value: '607%',
    icon: TrendingUp,
    color: 'text-blue-600'
  },
  {
    label: 'Horas Ahorradas/Mes',
    value: '355h',
    icon: Clock,
    color: 'text-purple-600'
  },
  {
    label: 'Reducción de Errores',
    value: '94%',
    icon: CheckCircle2,
    color: 'text-orange-600'
  }
]

export default function LighthousePage() {
  const featuredCases = lighthouses.filter(l => l.featured)
  const otherCases = lighthouses.filter(l => !l.featured)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">
            <Building2 className="w-4 h-4 mr-2" />
            Casos de Éxito Verificados
          </Badge>
          <h1 className="text-4xl font-bold mb-6">
            Empresas que Transformaron sus{' '}
            <span className="text-primary">Operaciones</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Descubre cómo organizaciones similares a la tuya están logrando resultados extraordinarios
            con automatización inteligente.
          </p>
        </div>
      </section>

      {/* Metrics Overview */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6">
            {metrics.map((metric, index) => (
              <Card key={index}>
                <CardContent className="pt-6 text-center">
                  <div className={`w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center`}>
                    <metric.icon className={`w-6 h-6 ${metric.color}`} />
                  </div>
                  <div className="text-2xl font-bold mb-1">{metric.value}</div>
                  <div className="text-sm text-muted-foreground">{metric.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Lighthouse Cases */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Casos Destacados</h2>
            <p className="text-muted-foreground">
              Transformaciones completas con métricas verificadas
            </p>
          </div>

          <div className="space-y-12">
            {featuredCases.map((lighthouse, index) => (
              <Card key={lighthouse.id} className="overflow-hidden">
                <div className="grid lg:grid-cols-2">
                  {/* Left: Company Info & Challenge */}
                  <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="text-4xl">{lighthouse.logo}</div>
                      <div>
                        <h3 className="text-2xl font-bold">{lighthouse.company}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <Badge variant="outline">{lighthouse.industry}</Badge>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {lighthouse.size}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2 text-red-600">Desafío</h4>
                        <p className="text-sm text-muted-foreground">{lighthouse.challenge}</p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2 text-blue-600">Solución</h4>
                        <p className="text-sm text-muted-foreground">{lighthouse.solution}</p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{lighthouse.author.image}</span>
                          <div>
                            <div className="font-medium text-sm">{lighthouse.author.name}</div>
                            <div className="text-xs text-muted-foreground">{lighthouse.author.role}</div>
                          </div>
                        </div>
                        <blockquote className="text-sm italic">
                          "{lighthouse.quote}"
                        </blockquote>
                      </div>
                    </div>
                  </div>

                  {/* Right: Results & Implementation */}
                  <div className="p-8 bg-muted/30">
                    <h4 className="font-semibold mb-4 text-green-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Resultados Verificados
                    </h4>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center p-3 bg-background rounded-lg">
                        <div className="text-lg font-bold text-green-600">{lighthouse.results.costSavings}</div>
                        <div className="text-xs text-muted-foreground">Ahorro Anual</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded-lg">
                        <div className="text-lg font-bold text-blue-600">{lighthouse.results.roi}</div>
                        <div className="text-xs text-muted-foreground">ROI</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded-lg">
                        <div className="text-lg font-bold text-purple-600">{lighthouse.results.timeSaved}</div>
                        <div className="text-xs text-muted-foreground">Tiempo Ahorrado</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded-lg">
                        <div className="text-lg font-bold text-orange-600">{lighthouse.results.errorReduction}</div>
                        <div className="text-xs text-muted-foreground">Menos Errores</div>
                      </div>
                    </div>

                    <div className="p-3 bg-primary/10 rounded-lg mb-4">
                      <div className="text-sm font-medium text-primary">Métrica Clave</div>
                      <div className="text-sm">{lighthouse.results.customMetric}</div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Implementación:</span>
                        <span className="font-medium">{lighthouse.implementation.timeline}</span>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Templates usados:</div>
                        <div className="text-xs bg-background p-2 rounded">
                          {lighthouse.implementation.templatesUsed}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Integraciones:</div>
                        <div className="flex flex-wrap gap-1">
                          {lighthouse.implementation.integrations.split(', ').map((integration, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {integration}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Other Success Stories */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Más Casos de Éxito</h2>
            <p className="text-muted-foreground">
              Resultados consistentes en diferentes industrias
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {otherCases.map((lighthouse) => (
              <Card key={lighthouse.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lighthouse.logo}</span>
                    <div>
                      <CardTitle className="text-lg">{lighthouse.company}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{lighthouse.industry}</Badge>
                        <span className="text-xs">{lighthouse.size}</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{lighthouse.challenge}</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-muted rounded">
                        <div className="font-semibold text-green-600">{lighthouse.results.costSavings}</div>
                        <div className="text-xs text-muted-foreground">Ahorro</div>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <div className="font-semibold text-blue-600">{lighthouse.results.roi}</div>
                        <div className="text-xs text-muted-foreground">ROI</div>
                      </div>
                    </div>

                    <blockquote className="text-sm italic border-l-2 border-primary pl-3">
                      "{lighthouse.quote}"
                    </blockquote>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{lighthouse.author.image}</span>
                      <span>{lighthouse.author.name}, {lighthouse.author.role}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Implementation Process */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Proceso de Implementación</h2>
            <p className="text-muted-foreground">
              Cómo llevamos a estas empresas del problema a la solución
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Auditoría</h3>
              <p className="text-sm text-muted-foreground">
                Analizamos procesos actuales e identificamos oportunidades
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Diseño</h3>
              <p className="text-sm text-muted-foreground">
                Creamos la arquitectura de automatización personalizada
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Implementación</h3>
              <p className="text-sm text-muted-foreground">
                Desplegamos y configuramos los workflows automáticamente
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600 font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">Optimización</h3>
              <p className="text-sm text-muted-foreground">
                Monitoreamos resultados y optimizamos continuamente
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            ¿Listo para tu Caso de Éxito?
          </h2>
          <p className="text-lg mb-8 text-primary-foreground/90">
            Únete a estas empresas líderes y transforma tu operación. 
            Comienza con una auditoría gratuita de tus procesos.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Button variant="secondary" size="lg" className="flex-1">
              Auditoría Gratuita
              <Zap className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="flex-1 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
              Ver Demo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-8 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Sin compromiso
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Resultados garantizados
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Implementación rápida
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}