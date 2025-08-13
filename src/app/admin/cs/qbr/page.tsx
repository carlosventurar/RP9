'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Calendar, Clock, Users, Target, TrendingUp, CheckCircle, AlertTriangle, Plus, Edit, Eye, MessageSquare, Video, FileText, Send } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface QBR {
  id: string
  tenant_id: string
  quarter: string
  assigned_csm: string
  scheduled_date: string
  actual_date?: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  priority: 'high' | 'medium' | 'low'
  agenda: any
  outcome?: string
  action_items?: string[]
  next_steps?: string
  notes?: string
  created_at: string
  completed_at?: string
  tenants: {
    name: string
    plan: string
    email: string
  }
}

interface QBRFormData {
  tenantId: string
  quarter: string
  csm: string
  scheduledDate: string
  priority: 'high' | 'medium' | 'low'
}

interface QBRUpdateData {
  status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  actualDate?: string
  outcome?: string
  actionItems?: string[]
  nextSteps?: string
  notes?: string
}

const statusConfig = {
  scheduled: {
    label: 'Programado',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    icon: '📅'
  },
  completed: {
    label: 'Completado',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: '✅'
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    icon: '❌'
  },
  rescheduled: {
    label: 'Reprogramado',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    icon: '🔄'
  }
}

const priorityConfig = {
  high: {
    label: 'Alta',
    color: 'bg-red-500',
    icon: '🔥'
  },
  medium: {
    label: 'Media',
    color: 'bg-yellow-500',
    icon: '⚡'
  },
  low: {
    label: 'Baja',
    color: 'bg-green-500',
    icon: '📋'
  }
}

const mockQBRs: QBR[] = [
  {
    id: '1',
    tenant_id: 'tenant-1',
    quarter: '2024-Q4',
    assigned_csm: 'María González',
    scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    priority: 'high',
    agenda: {
      quarterSummary: {
        healthScore: 78,
        totalTickets: 5,
        criticalTickets: 1,
        plan: 'enterprise'
      },
      discussionTopics: [
        'Revisión de Health Score y métricas clave',
        'Análisis de tickets y resolución de issues',
        'Adopción de nuevas funcionalidades',
        'Roadmap y próximas releases',
        'Objetivos para el próximo quarter'
      ]
    },
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    tenants: {
      name: 'TechCorp Solutions',
      plan: 'enterprise',
      email: 'admin@techcorp.com'
    }
  },
  {
    id: '2',
    tenant_id: 'tenant-2',
    quarter: '2024-Q4',
    assigned_csm: 'Carlos Ruiz',
    scheduled_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    actual_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    priority: 'medium',
    agenda: {},
    outcome: 'Excelente reunión. Cliente muy satisfecho con el progreso y nuevas features.',
    action_items: [
      'Configurar nueva integración con Salesforce',
      'Programar training session para equipo ampliado',
      'Evaluar upgrade a plan Enterprise Plus'
    ],
    next_steps: 'Seguimiento en 30 días para revisar implementación de action items',
    notes: 'Cliente mostró mucho interés en features de AI. Potential upsell opportunity.',
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tenants: {
      name: 'Digital Marketing Pro',
      plan: 'pro',
      email: 'contact@digitalmarketing.com'
    }
  },
  {
    id: '3',
    tenant_id: 'tenant-3',
    quarter: '2024-Q4',
    assigned_csm: 'Ana López',
    scheduled_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    priority: 'low',
    agenda: {},
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    tenants: {
      name: 'StartupXYZ',
      plan: 'pro',
      email: 'founder@startupxyz.com'
    }
  }
]

export default function QBRManagementPage() {
  const [qbrs, setQBRs] = useState<QBR[]>(mockQBRs)
  const [selectedQBR, setSelectedQBR] = useState<QBR | null>(null)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [showNewQBRDialog, setShowNewQBRDialog] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newQBRForm, setNewQBRForm] = useState<QBRFormData>({
    tenantId: '',
    quarter: '',
    csm: '',
    scheduledDate: '',
    priority: 'medium'
  })
  const [updateForm, setUpdateForm] = useState<QBRUpdateData>({})

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true,
      locale: es
    })
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusInfo = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.scheduled
  }

  const getPriorityInfo = (priority: string) => {
    return priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
  }

  const upcomingQBRs = qbrs.filter(q => q.status === 'scheduled' || q.status === 'rescheduled')
  const completedQBRs = qbrs.filter(q => q.status === 'completed')
  const cancelledQBRs = qbrs.filter(q => q.status === 'cancelled')

  const handleCreateQBR = async () => {
    setLoading(true)
    try {
      // TODO: Llamar a la API
      console.log('Creating QBR:', newQBRForm)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setShowNewQBRDialog(false)
      setNewQBRForm({
        tenantId: '',
        quarter: '',
        csm: '',
        scheduledDate: '',
        priority: 'medium'
      })
    } catch (error) {
      console.error('Error creating QBR:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateQBR = async () => {
    if (!selectedQBR) return
    
    setLoading(true)
    try {
      // TODO: Llamar a la API
      console.log('Updating QBR:', selectedQBR.id, updateForm)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Actualizar local state
      setQBRs(prev => prev.map(q => 
        q.id === selectedQBR.id 
          ? { ...q, ...updateForm, updated_at: new Date().toISOString() }
          : q
      ))
      
      setShowUpdateDialog(false)
      setSelectedQBR(null)
      setUpdateForm({})
    } catch (error) {
      console.error('Error updating QBR:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysUntilQBR = (date: string) => {
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  const getQuarterProgress = (quarter: string) => {
    const [year, q] = quarter.split('-Q')
    const quarterNum = parseInt(q)
    const startMonth = (quarterNum - 1) * 3
    const startDate = new Date(parseInt(year), startMonth, 1)
    const endDate = new Date(parseInt(year), startMonth + 3, 0)
    const now = new Date()
    
    if (now < startDate) return 0
    if (now > endDate) return 100
    
    const totalDays = endDate.getTime() - startDate.getTime()
    const elapsedDays = now.getTime() - startDate.getTime()
    return Math.round((elapsedDays / totalDays) * 100)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Admin
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Calendar className="h-8 w-8" />
              Gestión de QBRs
            </h1>
            <p className="text-muted-foreground mt-2">
              Quarterly Business Reviews programados y completados
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Exportar Reporte
            </Button>
            <Button onClick={() => setShowNewQBRDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Programar QBR
            </Button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{upcomingQBRs.length}</div>
              <div className="text-sm text-muted-foreground">QBRs Próximos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{completedQBRs.length}</div>
              <div className="text-sm text-muted-foreground">Completados Q4</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(completedQBRs.length / (completedQBRs.length + upcomingQBRs.length + cancelledQBRs.length) * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Tasa Completado</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {getQuarterProgress('2024-Q4')}%
              </div>
              <div className="text-sm text-muted-foreground">Progreso Q4</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming">Próximos ({upcomingQBRs.length})</TabsTrigger>
            <TabsTrigger value="completed">Completados ({completedQBRs.length})</TabsTrigger>
            <TabsTrigger value="all">Todos los QBRs</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Próximos QBRs */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingQBRs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No hay QBRs próximos</h3>
                  <p className="text-muted-foreground mb-4">
                    Programa QBRs para mantener el engagement con tus clientes
                  </p>
                  <Button onClick={() => setShowNewQBRDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Programar Primer QBR
                  </Button>
                </CardContent>
              </Card>
            ) : (
              upcomingQBRs.map((qbr) => {
                const statusInfo = getStatusInfo(qbr.status)
                const priorityInfo = getPriorityInfo(qbr.priority)
                const daysUntil = getDaysUntilQBR(qbr.scheduled_date)
                
                return (
                  <Card key={qbr.id} className={`${daysUntil <= 3 ? 'border-orange-200 bg-orange-50' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            {qbr.tenants.name}
                            <Badge className={priorityInfo.color} variant="secondary">
                              {priorityInfo.icon} {priorityInfo.label}
                            </Badge>
                          </h3>
                          <p className="text-muted-foreground">
                            {qbr.quarter} • CSM: {qbr.assigned_csm} • Plan: {qbr.tenants.plan.toUpperCase()}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(qbr.scheduled_date)}
                            </span>
                            <span className={`flex items-center gap-1 ${daysUntil <= 3 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                              <Clock className="h-4 w-4" />
                              {daysUntil > 0 ? `En ${daysUntil} días` : daysUntil === 0 ? 'Hoy' : `Hace ${Math.abs(daysUntil)} días`}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={statusInfo.color} variant="secondary">
                            {statusInfo.icon} {statusInfo.label}
                          </Badge>
                        </div>
                      </div>

                      {qbr.agenda?.quarterSummary && (
                        <div className="bg-muted/50 p-3 rounded-lg mb-4">
                          <h4 className="font-medium text-sm mb-2">Resumen del Quarter:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Health Score:</span>
                              <div className="font-medium">{qbr.agenda.quarterSummary.healthScore}/100</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tickets:</span>
                              <div className="font-medium">{qbr.agenda.quarterSummary.totalTickets}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Críticos:</span>
                              <div className="font-medium text-red-600">{qbr.agenda.quarterSummary.criticalTickets}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Plan:</span>
                              <div className="font-medium capitalize">{qbr.agenda.quarterSummary.plan}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedQBR(qbr)
                            setUpdateForm({})
                            setShowUpdateDialog(true)
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Contactar Cliente
                        </Button>
                        <Button variant="outline" size="sm">
                          <Video className="h-3 w-3 mr-1" />
                          Generar Meeting Link
                        </Button>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3 mr-1" />
                          Ver Detalles
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>

          {/* QBRs Completados */}
          <TabsContent value="completed" className="space-y-4">
            {completedQBRs.map((qbr) => {
              const statusInfo = getStatusInfo(qbr.status)
              
              return (
                <Card key={qbr.id} className="border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{qbr.tenants.name}</h3>
                        <p className="text-muted-foreground">
                          {qbr.quarter} • CSM: {qbr.assigned_csm} • Completado {formatTimeAgo(qbr.completed_at!)}
                        </p>
                      </div>
                      <Badge className={statusInfo.color} variant="secondary">
                        {statusInfo.icon} {statusInfo.label}
                      </Badge>
                    </div>

                    {qbr.outcome && (
                      <div className="bg-green-50 p-3 rounded-lg mb-3">
                        <h4 className="font-medium text-sm mb-1">Resultado:</h4>
                        <p className="text-sm">{qbr.outcome}</p>
                      </div>
                    )}

                    {qbr.action_items && qbr.action_items.length > 0 && (
                      <div className="bg-blue-50 p-3 rounded-lg mb-3">
                        <h4 className="font-medium text-sm mb-2">Action Items:</h4>
                        <ul className="text-sm space-y-1">
                          {qbr.action_items.map((item, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 mt-0.5 text-blue-600 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {qbr.next_steps && (
                      <div className="bg-yellow-50 p-3 rounded-lg mb-3">
                        <h4 className="font-medium text-sm mb-1">Próximos Pasos:</h4>
                        <p className="text-sm">{qbr.next_steps}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <FileText className="h-3 w-3 mr-1" />
                        Ver Reporte Completo
                      </Button>
                      <Button variant="outline" size="sm">
                        <Send className="h-3 w-3 mr-1" />
                        Enviar Resumen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          {/* Todos los QBRs */}
          <TabsContent value="all" className="space-y-4">
            <div className="space-y-4">
              {qbrs.map((qbr) => {
                const statusInfo = getStatusInfo(qbr.status)
                const priorityInfo = getPriorityInfo(qbr.priority)
                
                return (
                  <Card key={qbr.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{qbr.tenants.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {qbr.quarter} • {qbr.assigned_csm} • {formatDate(qbr.scheduled_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={priorityInfo.color} variant="secondary" size="sm">
                            {priorityInfo.label}
                          </Badge>
                          <Badge className={statusInfo.color} variant="secondary">
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance por CSM</CardTitle>
                  <CardDescription>
                    QBRs completados por Customer Success Manager
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['María González', 'Carlos Ruiz', 'Ana López'].map((csm) => {
                      const csmQBRs = qbrs.filter(q => q.assigned_csm === csm)
                      const completed = csmQBRs.filter(q => q.status === 'completed').length
                      const total = csmQBRs.length
                      const rate = total > 0 ? (completed / total) * 100 : 0
                      
                      return (
                        <div key={csm} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{csm}</span>
                            <span>{completed}/{total} ({Math.round(rate)}%)</span>
                          </div>
                          <Progress value={rate} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>QBRs por Plan</CardTitle>
                  <CardDescription>
                    Distribución de QBRs según plan del cliente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['enterprise', 'pro', 'starter'].map((plan) => {
                      const planQBRs = qbrs.filter(q => q.tenants.plan === plan)
                      const count = planQBRs.length
                      const percentage = qbrs.length > 0 ? (count / qbrs.length) * 100 : 0
                      
                      return (
                        <div key={plan} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              plan === 'enterprise' ? 'bg-purple-500' :
                              plan === 'pro' ? 'bg-blue-500' : 'bg-green-500'
                            }`} />
                            <span className="capitalize">{plan}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{count}</div>
                            <div className="text-xs text-muted-foreground">{Math.round(percentage)}%</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog para nuevo QBR */}
        <Dialog open={showNewQBRDialog} onOpenChange={setShowNewQBRDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Programar Nuevo QBR</DialogTitle>
              <DialogDescription>
                Programa una reunión de revisión trimestral con el cliente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tenant">Cliente</Label>
                <Select 
                  value={newQBRForm.tenantId} 
                  onValueChange={(value) => setNewQBRForm(prev => ({ ...prev, tenantId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant-1">TechCorp Solutions</SelectItem>
                    <SelectItem value="tenant-2">Digital Marketing Pro</SelectItem>
                    <SelectItem value="tenant-3">StartupXYZ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="quarter">Quarter</Label>
                <Select 
                  value={newQBRForm.quarter} 
                  onValueChange={(value) => setNewQBRForm(prev => ({ ...prev, quarter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-Q4">2024 Q4</SelectItem>
                    <SelectItem value="2025-Q1">2025 Q1</SelectItem>
                    <SelectItem value="2025-Q2">2025 Q2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="csm">Customer Success Manager</Label>
                <Select 
                  value={newQBRForm.csm} 
                  onValueChange={(value) => setNewQBRForm(prev => ({ ...prev, csm: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Asignar CSM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="María González">María González</SelectItem>
                    <SelectItem value="Carlos Ruiz">Carlos Ruiz</SelectItem>
                    <SelectItem value="Ana López">Ana López</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date">Fecha y Hora</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={newQBRForm.scheduledDate}
                  onChange={(e) => setNewQBRForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <Select 
                  value={newQBRForm.priority} 
                  onValueChange={(value: 'high' | 'medium' | 'low') => setNewQBRForm(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔥 Alta</SelectItem>
                    <SelectItem value="medium">⚡ Media</SelectItem>
                    <SelectItem value="low">📋 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewQBRDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateQBR} disabled={loading}>
                {loading ? 'Programando...' : 'Programar QBR'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para actualizar QBR */}
        <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Actualizar QBR - {selectedQBR?.tenants.name}</DialogTitle>
              <DialogDescription>
                {selectedQBR?.quarter} • {selectedQBR?.assigned_csm}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select 
                  value={updateForm.status || selectedQBR?.status} 
                  onValueChange={(value: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled') => 
                    setUpdateForm(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">📅 Programado</SelectItem>
                    <SelectItem value="completed">✅ Completado</SelectItem>
                    <SelectItem value="cancelled">❌ Cancelado</SelectItem>
                    <SelectItem value="rescheduled">🔄 Reprogramado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(updateForm.status === 'completed' || selectedQBR?.status === 'completed') && (
                <>
                  <div>
                    <Label htmlFor="outcome">Resultado del QBR</Label>
                    <Textarea
                      id="outcome"
                      placeholder="Resumen del outcome y principales puntos discutidos..."
                      value={updateForm.outcome || selectedQBR?.outcome || ''}
                      onChange={(e) => setUpdateForm(prev => ({ ...prev, outcome: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="actionItems">Action Items (uno por línea)</Label>
                    <Textarea
                      id="actionItems"
                      placeholder="- Configurar nueva integración&#10;- Programar training session&#10;- Evaluar upgrade de plan"
                      value={updateForm.actionItems?.join('\n') || selectedQBR?.action_items?.join('\n') || ''}
                      onChange={(e) => setUpdateForm(prev => ({ 
                        ...prev, 
                        actionItems: e.target.value.split('\n').filter(item => item.trim())
                      }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="nextSteps">Próximos Pasos</Label>
                    <Textarea
                      id="nextSteps"
                      placeholder="Seguimiento programado, próximas acciones..."
                      value={updateForm.nextSteps || selectedQBR?.next_steps || ''}
                      onChange={(e) => setUpdateForm(prev => ({ ...prev, nextSteps: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas internas, observaciones, oportunidades..."
                  value={updateForm.notes || selectedQBR?.notes || ''}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateQBR} disabled={loading}>
                {loading ? 'Actualizando...' : 'Actualizar QBR'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}