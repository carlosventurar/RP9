'use client'

import { useState } from 'react'
import { Metadata } from 'next'
import { Calendar, Clock, Users, Play, CheckCircle2, Star, ArrowRight, Video, Zap, BookOpen, Award, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const upcomingWebinars = [
  {
    id: 'automation-fundamentals',
    title: 'Automatización de Procesos: Fundamentos para Empresas',
    description: 'Aprende los conceptos básicos de automatización y cómo identificar procesos que puedes automatizar en tu empresa.',
    date: '2024-01-25',
    time: '15:00',
    duration: '60 min',
    instructor: {
      name: 'Carlos Ruiz',
      role: 'Automation Expert',
      avatar: '👨‍💻'
    },
    topics: [
      'Qué procesos automatizar primero',
      'ROI de automatización',
      'Herramientas y estrategias',
      'Casos de éxito reales'
    ],
    attendees: 247,
    maxAttendees: 500,
    level: 'Principiante',
    language: 'Español',
    featured: true
  },
  {
    id: 'ecommerce-automation',
    title: 'Automatización para E-commerce: De Manual a Automático',
    description: 'Transforma tu tienda online automatizando inventario, pedidos, marketing y atención al cliente.',
    date: '2024-01-30',
    time: '14:00',
    duration: '75 min',
    instructor: {
      name: 'María González',
      role: 'E-commerce Specialist',
      avatar: '👩‍💼'
    },
    topics: [
      'Sincronización de inventario multi-canal',
      'Automatización de email marketing',
      'Chatbots para atención al cliente',
      'Integración con plataformas'
    ],
    attendees: 189,
    maxAttendees: 300,
    level: 'Intermedio',
    language: 'Español'
  },
  {
    id: 'crm-workflows',
    title: 'Workflows CRM Avanzados: Ventas en Piloto Automático',
    description: 'Construye pipelines de ventas automatizados que nutren leads y cierran más deals.',
    date: '2024-02-05',
    time: '16:00',
    duration: '90 min',
    instructor: {
      name: 'Roberto Silva',
      role: 'Sales Automation Expert',
      avatar: '👨‍💼'
    },
    topics: [
      'Lead scoring automático',
      'Nurturing sequences',
      'Follow-up inteligente',
      'Analytics y optimización'
    ],
    attendees: 156,
    maxAttendees: 250,
    level: 'Avanzado',
    language: 'Español'
  }
]

const onDemandWebinars = [
  {
    id: 'getting-started',
    title: 'Cómo Empezar con RP9: Primeros Pasos',
    description: 'Tutorial completo para configurar tu primera automatización en menos de 30 minutos.',
    duration: '45 min',
    views: 1250,
    rating: 4.8,
    thumbnail: '🚀',
    category: 'Principiante'
  },
  {
    id: 'integration-masterclass',
    title: 'Masterclass: Integraciones Complejas',
    description: 'Conecta sistemas complejos y crea workflows avanzados con APIs y webhooks.',
    duration: '120 min',
    views: 890,
    rating: 4.9,
    thumbnail: '🔗',
    category: 'Avanzado'
  },
  {
    id: 'roi-optimization',
    title: 'Maximiza tu ROI: Optimización de Automatizaciones',
    description: 'Técnicas avanzadas para medir, analizar y optimizar tus procesos automatizados.',
    duration: '75 min',
    views: 675,
    rating: 4.7,
    thumbnail: '📈',
    category: 'Intermedio'
  }
]

const officeHours = [
  {
    day: 'Martes',
    time: '10:00 - 11:00',
    topic: 'Q&A General - Consultas Abiertas',
    host: 'Equipo RP9'
  },
  {
    day: 'Jueves',
    time: '15:00 - 16:00',
    topic: 'Deep Dive - Casos Técnicos Complejos',
    host: 'Technical Team'
  },
  {
    day: 'Viernes',
    time: '14:00 - 15:00',
    topic: 'Business Strategy - ROI y Planificación',
    host: 'Business Team'
  }
]

export default function WebinarsPage() {
  const [selectedWebinar, setSelectedWebinar] = useState<string>('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: ''
  })

  const handleRegister = (webinarId: string) => {
    setSelectedWebinar(webinarId)
    // In real app, this would open a modal or redirect to registration
    console.log('Registering for webinar:', webinarId, formData)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">
            <Video className="w-4 h-4 mr-2" />
            Webinars y Training
          </Badge>
          <h1 className="text-4xl font-bold mb-6">
            Aprende{' '}
            <span className="text-primary">Automatización</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Webinars en vivo, contenido bajo demanda y Office Hours con expertos.
            Mejora tus habilidades de automatización desde lo básico hasta lo avanzado.
          </p>
          
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Gratis para usuarios
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Certificados incluidos
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Acceso a grabaciones
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Webinars */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Próximos Webinars</h2>
            <p className="text-muted-foreground">
              Sesiones en vivo con expertos en automatización
            </p>
          </div>

          <div className="space-y-6">
            {upcomingWebinars.map((webinar) => (
              <Card key={webinar.id} className={`${webinar.featured ? 'border-primary shadow-lg' : ''}`}>
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Content */}
                  <div className="lg:col-span-2 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {webinar.featured && (
                            <Badge className="bg-primary text-primary-foreground">
                              <Star className="w-3 h-3 mr-1" />
                              Destacado
                            </Badge>
                          )}
                          <Badge variant="outline">{webinar.level}</Badge>
                          <Badge variant="secondary">{webinar.language}</Badge>
                        </div>
                        <h3 className="text-xl font-bold mb-2">{webinar.title}</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                          {webinar.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      {/* Schedule Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span>{new Date(webinar.date).toLocaleDateString('es-ES', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-primary" />
                          <span>{webinar.time} ({webinar.duration})</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-primary" />
                          <span>{webinar.attendees}/{webinar.maxAttendees} registrados</span>
                        </div>
                      </div>

                      {/* Instructor */}
                      <div className="bg-muted/30 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{webinar.instructor.avatar}</span>
                          <div>
                            <div className="font-medium text-sm">{webinar.instructor.name}</div>
                            <div className="text-xs text-muted-foreground">{webinar.instructor.role}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Topics */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2">Temas a cubrir:</h4>
                      <div className="grid md:grid-cols-2 gap-1">
                        {webinar.topics.map((topic, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                            <span>{topic}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Registration */}
                  <div className="p-6 bg-muted/30">
                    <div className="text-center mb-6">
                      <div className="text-2xl font-bold text-primary mb-1">GRATIS</div>
                      <div className="text-xs text-muted-foreground">Para usuarios de RP9</div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <Input placeholder="Nombre completo" />
                      <Input type="email" placeholder="Email" />
                      <Input placeholder="Empresa" />
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Tu rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ceo">CEO/Founder</SelectItem>
                          <SelectItem value="ops">Operations</SelectItem>
                          <SelectItem value="it">IT/Tech</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      className="w-full mb-4"
                      onClick={() => handleRegister(webinar.id)}
                    >
                      Registrarse Gratis
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>

                    <div className="text-xs text-center text-muted-foreground">
                      ✓ Certificado de participación<br />
                      ✓ Acceso a grabación<br />
                      ✓ Materiales descargables
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* On-Demand Content */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Contenido Bajo Demanda</h2>
            <p className="text-muted-foreground">
              Aprende a tu ritmo con nuestros webinars grabados
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {onDemandWebinars.map((webinar) => (
              <Card key={webinar.id} className="overflow-hidden">
                <div className="relative bg-muted/50 h-40 flex items-center justify-center">
                  <span className="text-6xl">{webinar.thumbnail}</span>
                  <Button 
                    className="absolute inset-0 bg-black/50 hover:bg-black/70 text-white opacity-0 hover:opacity-100 transition-opacity"
                    variant="ghost"
                  >
                    <Play className="w-8 h-8" />
                  </Button>
                </div>
                
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {webinar.category}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current text-yellow-400" />
                      <span className="text-xs">{webinar.rating}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{webinar.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {webinar.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {webinar.duration}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {webinar.views} views
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    <Play className="w-4 h-4 mr-2" />
                    Ver Ahora
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" size="lg">
              Ver Todos los Videos
              <BookOpen className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Office Hours */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Office Hours</h2>
            <p className="text-muted-foreground">
              Sesiones semanales de Q&A con nuestro equipo de expertos
            </p>
          </div>

          <div className="space-y-4">
            {officeHours.map((session, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="font-semibold text-primary">{session.day}</div>
                        <div className="text-sm text-muted-foreground">{session.time}</div>
                      </div>
                      <div>
                        <div className="font-medium mb-1">{session.topic}</div>
                        <div className="text-sm text-muted-foreground">Con {session.host}</div>
                      </div>
                    </div>
                    <Button variant="outline">
                      <Calendar className="w-4 h-4 mr-2" />
                      Unirse
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Award className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Office Hours Premium</span>
              </div>
              <p className="text-sm text-blue-800 mb-3">
                Sesiones 1:1 personalizadas para revisar tus automatizaciones específicas
              </p>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                Reservar Sesión
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Recursos Adicionales</h2>
            <p className="text-muted-foreground">
              Complementa tu aprendizaje con estos recursos
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Guías Escritas</CardTitle>
                <CardDescription>
                  Documentación detallada y step-by-step guides
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDFs
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-3">
                  <Award className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle>Certificaciones</CardTitle>
                <CardDescription>
                  Obtén certificados oficiales en automatización
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Ver Programas
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Comunidad</CardTitle>
                <CardDescription>
                  Únete a nuestra comunidad de automators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Unirse al Slack
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Acelera tu Aprendizaje
          </h2>
          <p className="text-lg mb-8 text-primary-foreground/90 max-w-2xl mx-auto">
            Únete a nuestros próximos webinars y conviértete en un experto en automatización.
            Todo el contenido es gratuito para usuarios de RP9.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Button variant="secondary" size="lg" className="flex-1">
              Ver Calendario
              <Calendar className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="flex-1 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
              Explorar Agente Virtual IA
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="mt-8 text-sm text-primary-foreground/70">
            <p>¿No eres usuario de Agente Virtual IA aún? <span className="underline cursor-pointer">Empieza gratis aquí</span></p>
          </div>
        </div>
      </section>
    </div>
  )
}