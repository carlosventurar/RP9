'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Bell, 
  X, 
  CheckCircle, 
  Trophy, 
  Star, 
  Target, 
  AlertCircle,
  Gift,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: 'success' | 'achievement' | 'warning' | 'info' | 'level_up'
  title: string
  message: string
  icon?: React.ComponentType<{ className?: string }>
  action?: {
    label: string
    onClick: () => void
  }
  timestamp: Date
  read: boolean
  priority: 'low' | 'normal' | 'high'
}

interface ProgressNotificationsProps {
  tenantId?: string
  onMarkRead?: (notificationId: string) => void
  className?: string
}

export default function ProgressNotifications({ 
  tenantId, 
  onMarkRead,
  className = '' 
}: ProgressNotificationsProps) {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tenantId) {
      loadNotifications()
    }
  }, [tenantId])

  const loadNotifications = async () => {
    if (!tenantId) return

    setLoading(true)
    try {
      const { data } = await supabase
        .from('onboarding_notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) {
        const parsedNotifications: Notification[] = data.map(notif => ({
          id: notif.id,
          type: getNotificationType(notif.type, notif.meta),
          title: getNotificationTitle(notif.type, notif.meta),
          message: notif.meta?.message || 'Notificación de progreso',
          icon: getNotificationIcon(notif.type, notif.meta),
          timestamp: new Date(notif.created_at),
          read: notif.read || false,
          priority: notif.meta?.priority || 'normal'
        }))

        setNotifications(parsedNotifications)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNotificationType = (type: string, meta: any): Notification['type'] => {
    if (meta?.level_up) return 'level_up'
    if (meta?.achievement) return 'achievement'
    if (meta?.priority === 'high') return 'warning'
    if (type === 'task_completed') return 'success'
    return 'info'
  }

  const getNotificationTitle = (type: string, meta: any): string => {
    if (meta?.level_up) return '¡Subiste de nivel!'
    if (meta?.achievement) return '¡Nuevo logro desbloqueado!'
    if (type === 'task_completed') return 'Tarea completada'
    if (type === 'digest') return 'Resumen de progreso'
    if (type === 'activation') return '¡Cuenta activada!'
    return 'Notificación'
  }

  const getNotificationIcon = (type: string, meta: any) => {
    if (meta?.level_up) return TrendingUp
    if (meta?.achievement) return Trophy
    if (type === 'task_completed') return CheckCircle
    if (type === 'digest') return Target
    if (type === 'activation') return Sparkles
    if (meta?.priority === 'high') return AlertCircle
    return Bell
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('onboarding_notifications')
        .update({ read: true })
        .eq('id', notificationId)

      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      )

      if (onMarkRead) {
        onMarkRead(notificationId)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId))
  }

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'border-green-200 bg-green-50'
      case 'achievement': return 'border-yellow-200 bg-yellow-50'
      case 'level_up': return 'border-purple-200 bg-purple-50'
      case 'warning': return 'border-orange-200 bg-orange-50'
      case 'info': return 'border-blue-200 bg-blue-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  const getIconColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'text-green-600'
      case 'achievement': return 'text-yellow-600'
      case 'level_up': return 'text-purple-600'
      case 'warning': return 'text-orange-600'
      case 'info': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const unreadNotifications = notifications.filter(n => !n.read)
  const displayNotifications = showAll ? notifications : notifications.slice(0, 3)

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Bell className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Cargando notificaciones...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (notifications.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Bell className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay notificaciones</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <h3 className="font-medium">Notificaciones</h3>
              {unreadNotifications.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadNotifications.length} nuevas
                </Badge>
              )}
            </div>
            {notifications.length > 3 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAll(!showAll)}
                className="text-xs"
              >
                {showAll ? 'Ver menos' : 'Ver todas'}
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {displayNotifications.map((notification) => {
              const IconComponent = notification.icon
              
              return (
                <div
                  key={notification.id}
                  className={`relative p-3 rounded-lg border ${getTypeColor(notification.type)} ${
                    !notification.read ? 'shadow-sm' : 'opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-full bg-white`}>
                      <IconComponent className={`w-4 h-4 ${getIconColor(notification.type)}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              {notification.timestamp.toLocaleTimeString('es-MX', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {notification.priority === 'high' && (
                              <Badge variant="destructive" className="text-xs px-1 py-0">
                                Prioritario
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissNotification(notification.id)}
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Action Button */}
                      {notification.action && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={notification.action.onClick}
                          className="mt-2 text-xs h-7"
                        >
                          {notification.action.label}
                        </Button>
                      )}

                      {/* Mark as Read */}
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="mt-1 text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                        >
                          Marcar como leída
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty State for All Read */}
          {notifications.length > 0 && unreadNotifications.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">¡Todas las notificaciones están al día!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}