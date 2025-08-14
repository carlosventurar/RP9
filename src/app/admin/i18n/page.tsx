'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Download, 
  Upload, 
  AlertCircle,
  CheckCircle,
  Globe,
  Search
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SUPPORTED_LOCALES = [
  { code: 'es-419', name: 'Español (América Latina)', flag: '🌎' },
  { code: 'es-MX', name: 'Español (México)', flag: '🇲🇽' },
  { code: 'es-CO', name: 'Español (Colombia)', flag: '🇨🇴' },
  { code: 'es-CL', name: 'Español (Chile)', flag: '🇨🇱' },
  { code: 'es-PE', name: 'Español (Perú)', flag: '🇵🇪' },
  { code: 'es-AR', name: 'Español (Argentina)', flag: '🇦🇷' },
  { code: 'es-DO', name: 'Español (Rep. Dominicana)', flag: '🇩🇴' },
  { code: 'en-US', name: 'English (United States)', flag: '🇺🇸' }
]

const NAMESPACES = [
  'common', 'navigation', 'auth', 'dashboard', 'billing', 
  'currency', 'workflows', 'templates', 'analytics', 'settings'
]

interface I18nMessage {
  id?: number
  locale: string
  namespace: string
  message_key: string
  message_value: string
  description?: string
  status: 'active' | 'draft' | 'deprecated'
  created_at?: string
  updated_at?: string
}

export default function I18nAdminPage() {
  const t = useTranslations()
  const [messages, setMessages] = useState<I18nMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLocale, setSelectedLocale] = useState('es-419')
  const [selectedNamespace, setSelectedNamespace] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingMessage, setEditingMessage] = useState<I18nMessage | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newMessage, setNewMessage] = useState<Partial<I18nMessage>>({
    locale: 'es-419',
    namespace: 'common',
    status: 'active'
  })

  // Load messages
  useEffect(() => {
    loadMessages()
  }, [selectedLocale, selectedNamespace])

  const loadMessages = async () => {
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from('i18n_messages')
        .select('*')
        .eq('locale', selectedLocale)
        .order('namespace', { ascending: true })
        .order('message_key', { ascending: true })
      
      if (selectedNamespace !== 'all') {
        query = query.eq('namespace', selectedNamespace)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      let filteredData = data || []
      
      // Apply search filter
      if (searchQuery) {
        filteredData = filteredData.filter(msg => 
          msg.message_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.message_value.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }
      
      setMessages(filteredData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading messages')
    } finally {
      setLoading(false)
    }
  }

  const saveMessage = async (message: I18nMessage) => {
    try {
      const { error } = await supabase
        .from('i18n_messages')
        .upsert({
          ...message,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'locale,namespace,message_key'
        })
      
      if (error) throw error
      
      setEditingMessage(null)
      loadMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving message')
    }
  }

  const addMessage = async () => {
    if (!newMessage.namespace || !newMessage.message_key || !newMessage.message_value) {
      setError('Please fill in all required fields')
      return
    }
    
    try {
      const { error } = await supabase
        .from('i18n_messages')
        .insert({
          ...newMessage,
          locale: selectedLocale,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (error) throw error
      
      setShowAddDialog(false)
      setNewMessage({
        locale: selectedLocale,
        namespace: 'common',
        status: 'active'
      })
      loadMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding message')
    }
  }

  const deleteMessage = async (id: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return
    
    try {
      const { error } = await supabase
        .from('i18n_messages')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      loadMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting message')
    }
  }

  const exportMessages = async () => {
    try {
      const response = await fetch('/api/admin/i18n/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: selectedLocale })
      })
      
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${selectedLocale}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const selectedLocaleInfo = SUPPORTED_LOCALES.find(l => l.code === selectedLocale)

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Gestión de Traducciones
          </h1>
          <p className="text-muted-foreground mt-2">
            Administra las traducciones de la aplicación para diferentes idiomas y regiones
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={exportMessages} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar JSON
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Mensaje
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Nuevo Mensaje</DialogTitle>
                <DialogDescription>
                  Crea un nuevo mensaje de traducción para {selectedLocaleInfo?.name}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="namespace">Namespace</Label>
                  <Select value={newMessage.namespace} onValueChange={(value) => 
                    setNewMessage({...newMessage, namespace: value})
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NAMESPACES.map(ns => (
                        <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="message_key">Clave del Mensaje</Label>
                  <Input
                    id="message_key"
                    placeholder="ej: billing.tax_id_required"
                    value={newMessage.message_key || ''}
                    onChange={(e) => setNewMessage({...newMessage, message_key: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="message_value">Valor del Mensaje</Label>
                  <Textarea
                    id="message_value"
                    placeholder="Texto traducido..."
                    value={newMessage.message_value || ''}
                    onChange={(e) => setNewMessage({...newMessage, message_value: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Input
                    id="description"
                    placeholder="Contexto para traductores..."
                    value={newMessage.description || ''}
                    onChange={(e) => setNewMessage({...newMessage, description: e.target.value})}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={addMessage}>
                  Agregar Mensaje
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtra los mensajes por idioma, namespace o búsqueda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Idioma</Label>
              <Select value={selectedLocale} onValueChange={setSelectedLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LOCALES.map(locale => (
                    <SelectItem key={locale.code} value={locale.code}>
                      {locale.flag} {locale.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <Label>Namespace</Label>
              <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los namespaces</SelectItem>
                  {NAMESPACES.map(ns => (
                    <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar mensajes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedLocaleInfo?.flag} Mensajes de {selectedLocaleInfo?.name}
            <Badge variant="secondary">{messages.length} mensajes</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {messages.map((message) => (
                <div key={message.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{message.namespace}</Badge>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {message.message_key}
                      </code>
                      {message.status === 'active' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    
                    {editingMessage?.id === message.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingMessage.message_value}
                          onChange={(e) => setEditingMessage({
                            ...editingMessage,
                            message_value: e.target.value
                          })}
                          className="min-h-[60px]"
                        />
                        <Input
                          placeholder="Descripción..."
                          value={editingMessage.description || ''}
                          onChange={(e) => setEditingMessage({
                            ...editingMessage,
                            description: e.target.value
                          })}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveMessage(editingMessage)}>
                            <Save className="w-4 h-4 mr-1" />
                            Guardar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingMessage(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm mb-1">{message.message_value}</p>
                        {message.description && (
                          <p className="text-xs text-muted-foreground italic">
                            {message.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setEditingMessage(message)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteMessage(message.id!)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron mensajes para los filtros seleccionados
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}