'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, AlertTriangle, Clock, Info, Upload, X } from 'lucide-react'
import Link from 'next/link'

interface FormData {
  subject: string
  description: string
  severity: 'P1' | 'P2' | 'P3' | ''
  channel: 'email' | 'chat' | 'slack' | ''
  tags: string[]
}

const severityConfig = {
  P1: {
    label: 'P1 - Crítico',
    description: 'Sistema no funcional, impacto total en el negocio',
    color: 'destructive' as const,
    icon: '🔴',
    sla: '1 hora primera respuesta, 2 horas resolución'
  },
  P2: {
    label: 'P2 - Alto',
    description: 'Funcionalidad importante afectada, impacto significativo',
    color: 'warning' as const,
    icon: '🟡',
    sla: '4 horas primera respuesta, 8 horas resolución'
  },
  P3: {
    label: 'P3 - Medio',
    description: 'Problema menor, consulta o mejora',
    color: 'default' as const,
    icon: '🟢',
    sla: '8 horas primera respuesta, 2 días resolución'
  }
}

const channelConfig = {
  email: {
    label: 'Email',
    description: 'Recibe actualizaciones por correo electrónico',
    icon: '📧',
    available: true
  },
  chat: {
    label: 'Chat en vivo',
    description: 'Soporte inmediato durante horario laboral',
    icon: '💬',
    available: true
  },
  slack: {
    label: 'Slack compartido',
    description: 'Canal dedicado (solo Enterprise)',
    icon: '📱',
    available: false // Se habilitaría según el plan
  }
}

const commonTags = [
  'n8n', 'workflows', 'integración', 'api', 'webhook', 'facturación',
  'rendimiento', 'dashboard', 'autenticación', 'usuarios', 'templates',
  'marketplace', 'analytics', 'configuración', 'bug', 'consulta'
]

export default function NewTicketPage() {
  const t = useTranslations('support')
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    subject: '',
    description: '',
    severity: '',
    channel: '',
    tags: []
  })
  const [customTag, setCustomTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.subject.trim()) {
      newErrors.subject = 'El asunto es requerido'
    } else if (formData.subject.length < 10) {
      newErrors.subject = 'El asunto debe tener al menos 10 caracteres'
    } else if (formData.subject.length > 200) {
      newErrors.subject = 'El asunto no puede exceder 200 caracteres'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida'
    } else if (formData.description.length < 20) {
      newErrors.description = 'La descripción debe tener al menos 20 caracteres'
    } else if (formData.description.length > 5000) {
      newErrors.description = 'La descripción no puede exceder 5000 caracteres'
    }

    if (!formData.severity) {
      newErrors.severity = 'La severidad es requerida'
    }

    if (!formData.channel) {
      newErrors.channel = 'El canal de soporte es requerido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }))
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleAddCustomTag = () => {
    if (customTag.trim()) {
      handleAddTag(customTag.trim().toLowerCase())
      setCustomTag('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // TODO: Reemplazar con llamada real a la API
      const response = await fetch('/.netlify/functions/support/create-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId: 'temp-tenant-id', // TODO: Obtener del contexto de autenticación
          subject: formData.subject,
          description: formData.description,
          severity: formData.severity,
          channel: formData.channel,
          tags: formData.tags,
          metadata: {
            source: 'portal_web',
            userAgent: navigator.userAgent
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear el ticket')
      }

      const result = await response.json()
      
      // Redirigir a la página de tickets con mensaje de éxito
      router.push(`/support?created=${result.ticket.id}`)
      
    } catch (error: any) {
      console.error('Error creating ticket:', error)
      setErrors({
        submit: error.message || 'Error al crear el ticket. Intenta nuevamente.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className=\"container mx-auto py-6 max-w-4xl\">
      {/* Header */}
      <div className=\"flex items-center gap-4 mb-6\">
        <Button variant=\"ghost\" size=\"sm\" asChild>
          <Link href=\"/support\">
            <ArrowLeft className=\"h-4 w-4 mr-2\" />
            Volver a Soporte
          </Link>
        </Button>
      </div>

      <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
        {/* Formulario principal */}
        <div className=\"lg:col-span-2\">
          <Card>
            <CardHeader>
              <CardTitle>Crear Nuevo Ticket</CardTitle>
              <CardDescription>
                Describe tu problema o consulta de manera detallada para recibir la mejor ayuda posible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className=\"space-y-6\">
                {/* Asunto */}
                <div>
                  <Label htmlFor=\"subject\">Asunto *</Label>
                  <Input
                    id=\"subject\"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder=\"Ej: Error en la integración con webhook de Stripe\"
                    className={errors.subject ? 'border-destructive' : ''}
                  />
                  {errors.subject && (
                    <p className=\"text-sm text-destructive mt-1\">{errors.subject}</p>
                  )}
                  <p className=\"text-xs text-muted-foreground mt-1\">
                    {formData.subject.length}/200 caracteres
                  </p>
                </div>

                {/* Descripción */}
                <div>
                  <Label htmlFor=\"description\">Descripción *</Label>
                  <Textarea
                    id=\"description\"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder=\"Describe el problema con el mayor detalle posible:&#10;- ¿Qué estabas intentando hacer?&#10;- ¿Qué esperabas que pasara?&#10;- ¿Qué pasó en realidad?&#10;- ¿Tienes algún mensaje de error?\"
                    rows={8}
                    className={errors.description ? 'border-destructive' : ''}
                  />
                  {errors.description && (
                    <p className=\"text-sm text-destructive mt-1\">{errors.description}</p>
                  )}
                  <p className=\"text-xs text-muted-foreground mt-1\">
                    {formData.description.length}/5000 caracteres
                  </p>
                </div>

                {/* Severidad */}
                <div>
                  <Label>Severidad *</Label>
                  <Select 
                    value={formData.severity} 
                    onValueChange={(value: 'P1' | 'P2' | 'P3') => setFormData(prev => ({ ...prev, severity: value }))}
                  >
                    <SelectTrigger className={errors.severity ? 'border-destructive' : ''}>
                      <SelectValue placeholder=\"Selecciona la severidad\" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(severityConfig).map(([severity, config]) => (
                        <SelectItem key={severity} value={severity}>
                          <div className=\"flex items-center gap-2\">
                            <span>{config.icon}</span>
                            <div>
                              <div className=\"font-medium\">{config.label}</div>
                              <div className=\"text-xs text-muted-foreground\">{config.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.severity && (
                    <p className=\"text-sm text-destructive mt-1\">{errors.severity}</p>
                  )}
                  {formData.severity && (
                    <Alert className=\"mt-2\">
                      <Clock className=\"h-4 w-4\" />
                      <AlertDescription>
                        <strong>SLA:</strong> {severityConfig[formData.severity].sla}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Canal de soporte */}
                <div>
                  <Label>Canal de Soporte *</Label>
                  <Select 
                    value={formData.channel} 
                    onValueChange={(value: 'email' | 'chat' | 'slack') => setFormData(prev => ({ ...prev, channel: value }))}
                  >
                    <SelectTrigger className={errors.channel ? 'border-destructive' : ''}>
                      <SelectValue placeholder=\"¿Cómo prefieres recibir soporte?\" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(channelConfig).map(([channel, config]) => (
                        <SelectItem 
                          key={channel} 
                          value={channel} 
                          disabled={!config.available}
                        >
                          <div className=\"flex items-center gap-2\">
                            <span>{config.icon}</span>
                            <div>
                              <div className={`font-medium ${!config.available ? 'text-muted-foreground' : ''}`}>
                                {config.label}
                                {!config.available && ' (No disponible)'}
                              </div>
                              <div className=\"text-xs text-muted-foreground\">{config.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.channel && (
                    <p className=\"text-sm text-destructive mt-1\">{errors.channel}</p>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <Label>Etiquetas (Opcional)</Label>
                  <div className=\"space-y-3\">
                    {/* Tags seleccionados */}
                    {formData.tags.length > 0 && (
                      <div className=\"flex flex-wrap gap-2\">
                        {formData.tags.map((tag) => (
                          <Badge key={tag} variant=\"secondary\" className=\"flex items-center gap-1\">
                            {tag}
                            <button
                              type=\"button\"
                              onClick={() => handleRemoveTag(tag)}
                              className=\"hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5\"
                            >
                              <X className=\"h-3 w-3\" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Tags comunes */}
                    <div>
                      <p className=\"text-sm text-muted-foreground mb-2\">Tags frecuentes:</p>
                      <div className=\"flex flex-wrap gap-2\">
                        {commonTags
                          .filter(tag => !formData.tags.includes(tag))
                          .slice(0, 10)
                          .map((tag) => (
                            <Button
                              key={tag}
                              type=\"button\"
                              variant=\"outline\"
                              size=\"sm\"
                              onClick={() => handleAddTag(tag)}
                              className=\"h-7 text-xs\"
                            >
                              + {tag}
                            </Button>
                          ))}
                      </div>
                    </div>

                    {/* Agregar tag personalizado */}
                    <div className=\"flex gap-2\">
                      <Input
                        value={customTag}
                        onChange={(e) => setCustomTag(e.target.value)}
                        placeholder=\"Agregar tag personalizado\"
                        className=\"text-sm\"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                      />
                      <Button
                        type=\"button\"
                        variant=\"outline\"
                        size=\"sm\"
                        onClick={handleAddCustomTag}
                        disabled={!customTag.trim()}
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Error de envío */}
                {errors.submit && (
                  <Alert variant=\"destructive\">
                    <AlertTriangle className=\"h-4 w-4\" />
                    <AlertDescription>{errors.submit}</AlertDescription>
                  </Alert>
                )}

                {/* Botones */}
                <div className=\"flex justify-end gap-3\">
                  <Button type=\"button\" variant=\"outline\" asChild>
                    <Link href=\"/support\">Cancelar</Link>
                  </Button>
                  <Button type=\"submit\" disabled={isSubmitting}>
                    {isSubmitting ? 'Creando...' : 'Crear Ticket'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar con información */}
        <div className=\"space-y-6\">
          {/* Información de SLA */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-base\">Tiempos de Respuesta</CardTitle>
            </CardHeader>
            <CardContent className=\"space-y-3\">
              {Object.entries(severityConfig).map(([severity, config]) => (
                <div key={severity} className=\"flex items-start gap-2\">
                  <span className=\"text-lg\">{config.icon}</span>
                  <div>
                    <div className=\"font-medium text-sm\">{config.label}</div>
                    <div className=\"text-xs text-muted-foreground\">{config.sla}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Consejos */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-base flex items-center gap-2\">
                <Info className=\"h-4 w-4\" />
                Consejos
              </CardTitle>
            </CardHeader>
            <CardContent className=\"text-sm space-y-2\">
              <ul className=\"space-y-2 text-muted-foreground\">
                <li>• Sé específico en el asunto y descripción</li>
                <li>• Incluye pasos para reproducir el problema</li>
                <li>• Adjunta capturas de pantalla si es relevante</li>
                <li>• Menciona tu configuración técnica</li>
                <li>• Usa tags para categorizar mejor tu consulta</li>
              </ul>
            </CardContent>
          </Card>

          {/* Base de conocimiento */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-base\">¿Necesitas ayuda inmediata?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className=\"text-sm text-muted-foreground mb-3\">
                Revisa nuestra base de conocimiento, tal vez encuentres la respuesta ahí.
              </p>
              <Button variant=\"outline\" size=\"sm\" asChild className=\"w-full\">
                <Link href=\"/support/kb\">Explorar KB</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}