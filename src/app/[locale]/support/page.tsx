'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Calendar, Clock, MessageSquare, Plus, Search, Filter, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es, en } from 'date-fns/locale'

interface Ticket {
  id: string
  subject: string
  description: string
  severity: 'P1' | 'P2' | 'P3'
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  channel: 'email' | 'chat' | 'slack'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  tags: string[]
  hubspot_ticket_id?: string
  first_response_at?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}

const severityConfig = {
  P1: { label: 'Crítico', color: 'destructive' as const, icon: '🔴' },
  P2: { label: 'Alto', color: 'warning' as const, icon: '🟡' },
  P3: { label: 'Medio', color: 'default' as const, icon: '🟢' }
}

const statusConfig = {
  open: { label: 'Abierto', color: 'destructive' as const },
  in_progress: { label: 'En Progreso', color: 'warning' as const },
  waiting: { label: 'Esperando', color: 'secondary' as const },
  resolved: { label: 'Resuelto', color: 'success' as const },
  closed: { label: 'Cerrado', color: 'default' as const }
}

const channelConfig = {
  email: { label: 'Email', icon: '📧' },
  chat: { label: 'Chat', icon: '💬' },
  slack: { label: 'Slack', icon: '📱' }
}

export default function SupportPage() {
  const t = useTranslations('support')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')

  // Simular carga de tickets (en producción vendría de la API)
  useEffect(() => {
    const loadTickets = async () => {
      setLoading(true)
      try {
        // TODO: Reemplazar con llamada real a API
        const mockTickets: Ticket[] = [
          {
            id: '1',
            subject: 'Error en la integración con n8n',
            description: 'Los workflows no se ejecutan correctamente después de la última actualización',
            severity: 'P1',
            status: 'in_progress',
            channel: 'email',
            priority: 'urgent',
            tags: ['n8n', 'integración', 'workflows'],
            hubspot_ticket_id: 'HS-001',
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
          },
          {
            id: '2',
            subject: 'Consulta sobre facturación',
            description: 'Necesito entender los cargos en mi última factura',
            severity: 'P3',
            status: 'waiting',
            channel: 'chat',
            priority: 'medium',
            tags: ['facturación', 'consulta'],
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '3',
            subject: 'Problema de rendimiento en dashboards',
            description: 'Los dashboards cargan muy lento, especialmente con muchos datos',
            severity: 'P2',
            status: 'resolved',
            channel: 'slack',
            priority: 'high',
            tags: ['rendimiento', 'dashboard'],
            resolved_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        ]
        
        setTickets(mockTickets)
      } catch (error) {
        console.error('Error loading tickets:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTickets()
  }, [])

  // Filtrar tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
    const matchesSeverity = severityFilter === 'all' || ticket.severity === severityFilter
    const matchesChannel = channelFilter === 'all' || ticket.channel === channelFilter
    
    return matchesSearch && matchesStatus && matchesSeverity && matchesChannel
  })

  const ticketsByStatus = {
    open: filteredTickets.filter(t => t.status === 'open').length,
    in_progress: filteredTickets.filter(t => t.status === 'in_progress').length,
    waiting: filteredTickets.filter(t => t.status === 'waiting').length,
    resolved: filteredTickets.filter(t => t.status === 'resolved').length,
    closed: filteredTickets.filter(t => t.status === 'closed').length
  }

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true,
      locale: es // TODO: Usar locale dinámico basado en i18n
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className=\"container mx-auto py-6 space-y-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div>
          <h1 className=\"text-3xl font-bold\">Centro de Soporte</h1>
          <p className=\"text-muted-foreground\">
            Gestiona tus tickets de soporte y consulta el estado de tus solicitudes
          </p>
        </div>
        <Button asChild>
          <Link href=\"/support/new\">
            <Plus className=\"h-4 w-4 mr-2\" />
            Nuevo Ticket
          </Link>
        </Button>
      </div>

      {/* Estadísticas rápidas */}
      <div className=\"grid grid-cols-2 md:grid-cols-5 gap-4\">
        {Object.entries(ticketsByStatus).map(([status, count]) => (
          <Card key={status}>
            <CardContent className=\"p-4 text-center\">
              <div className=\"text-2xl font-bold\">{count}</div>
              <div className=\"text-sm text-muted-foreground\">
                {statusConfig[status as keyof typeof statusConfig].label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className=\"flex items-center gap-2\">
            <Filter className=\"h-4 w-4\" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
            <div>
              <label className=\"text-sm font-medium mb-2 block\">Buscar</label>
              <div className=\"relative\">
                <Search className=\"h-4 w-4 absolute left-3 top-3 text-muted-foreground\" />
                <Input
                  placeholder=\"Buscar tickets...\"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className=\"pl-10\"
                />
              </div>
            </div>
            
            <div>
              <label className=\"text-sm font-medium mb-2 block\">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"all\">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className=\"text-sm font-medium mb-2 block\">Severidad</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"all\">Todas</SelectItem>
                  {Object.entries(severityConfig).map(([severity, config]) => (
                    <SelectItem key={severity} value={severity}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className=\"text-sm font-medium mb-2 block\">Canal</label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"all\">Todos</SelectItem>
                  {Object.entries(channelConfig).map(([channel, config]) => (
                    <SelectItem key={channel} value={channel}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de tickets */}
      <div className=\"space-y-4\">
        {filteredTickets.length === 0 ? (
          <Card>
            <CardContent className=\"p-8 text-center\">
              <MessageSquare className=\"h-12 w-12 mx-auto mb-4 text-muted-foreground\" />
              <h3 className=\"text-lg font-semibold mb-2\">No hay tickets</h3>
              <p className=\"text-muted-foreground mb-4\">
                {searchTerm || statusFilter !== 'all' || severityFilter !== 'all' || channelFilter !== 'all'
                  ? 'No se encontraron tickets con los filtros aplicados'
                  : 'Aún no tienes tickets de soporte'}
              </p>
              <Button asChild>
                <Link href=\"/support/new\">Crear primer ticket</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className=\"hover:shadow-md transition-shadow\">
              <CardContent className=\"p-6\">
                <div className=\"flex items-start justify-between\">
                  <div className=\"flex-1\">
                    <div className=\"flex items-center gap-3 mb-2\">
                      <h3 className=\"font-semibold text-lg\">{ticket.subject}</h3>
                      <Badge variant={severityConfig[ticket.severity].color}>
                        {severityConfig[ticket.severity].icon} {ticket.severity}
                      </Badge>
                      <Badge variant={statusConfig[ticket.status].color}>
                        {statusConfig[ticket.status].label}
                      </Badge>
                      <Badge variant=\"outline\">
                        {channelConfig[ticket.channel].icon} {channelConfig[ticket.channel].label}
                      </Badge>
                    </div>
                    
                    <p className=\"text-muted-foreground mb-3 line-clamp-2\">
                      {ticket.description}
                    </p>
                    
                    <div className=\"flex items-center gap-4 text-sm text-muted-foreground\">
                      <div className=\"flex items-center gap-1\">
                        <Calendar className=\"h-4 w-4\" />
                        Creado {formatTimeAgo(ticket.created_at)}
                      </div>
                      <div className=\"flex items-center gap-1\">
                        <Clock className=\"h-4 w-4\" />
                        Actualizado {formatTimeAgo(ticket.updated_at)}
                      </div>
                      {ticket.hubspot_ticket_id && (
                        <div className=\"text-xs text-muted-foreground\">
                          ID: {ticket.hubspot_ticket_id}
                        </div>
                      )}
                    </div>

                    {ticket.tags.length > 0 && (
                      <div className=\"flex items-center gap-2 mt-3\">
                        {ticket.tags.map((tag) => (
                          <Badge key={tag} variant=\"secondary\" className=\"text-xs\">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className=\"flex flex-col gap-2 ml-4\">
                    <Button variant=\"outline\" size=\"sm\">
                      Ver Detalles
                    </Button>
                    {ticket.status === 'waiting' && (
                      <Button variant=\"ghost\" size=\"sm\">
                        Responder
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Enlaces rápidos */}
      <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
        <Card>
          <CardHeader>
            <CardTitle className=\"text-base\">SLA & Tiempos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className=\"text-sm text-muted-foreground mb-3\">
              Consulta nuestros acuerdos de nivel de servicio
            </p>
            <Button variant=\"outline\" size=\"sm\" asChild>
              <Link href=\"/support/sla\">Ver SLA</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className=\"text-base\">Base de Conocimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className=\"text-sm text-muted-foreground mb-3\">
              Encuentra respuestas a preguntas frecuentes
            </p>
            <Button variant=\"outline\" size=\"sm\" asChild>
              <Link href=\"/support/kb\">Explorar KB</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className=\"text-base\">Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <p className=\"text-sm text-muted-foreground mb-3\">
              Revisa el estado actual de nuestros servicios
            </p>
            <Button variant=\"outline\" size=\"sm\" asChild>
              <Link href=\"/support/incidents\">Ver Estado</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}