'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useNavigationTranslations, useAuthTranslations } from '@/hooks/use-translations'
import { useState, useEffect } from 'react'

export default function AccountSettingsPage() {
  const navT = useNavigationTranslations()
  const authT = useAuthTranslations()
  const [timezone, setTimezone] = useState('America/Mexico_City')
  const [language, setLanguage] = useState('es-MX')
  const [currentTime, setCurrentTime] = useState('')

  // Update current time every second for the selected timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const timeString = now.toLocaleString('es-MX', {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'medium'
      })
      setCurrentTime(timeString)
    }
    
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [timezone])

  // Common timezones for Latin America and international users
  const timezones = [
    { value: 'America/Mexico_City', label: 'México (GMT-6)', country: 'MX' },
    { value: 'America/Bogota', label: 'Colombia (GMT-5)', country: 'CO' },
    { value: 'America/Santiago', label: 'Chile (GMT-3)', country: 'CL' },
    { value: 'America/Lima', label: 'Perú (GMT-5)', country: 'PE' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (GMT-3)', country: 'AR' },
    { value: 'America/Santo_Domingo', label: 'República Dominicana (GMT-4)', country: 'DO' },
    { value: 'America/New_York', label: 'Estados Unidos - Este (GMT-5)', country: 'US' },
    { value: 'America/Los_Angeles', label: 'Estados Unidos - Oeste (GMT-8)', country: 'US' },
    { value: 'Europe/Madrid', label: 'España (GMT+1)', country: 'ES' },
    { value: 'UTC', label: 'UTC (GMT+0)', country: 'WORLD' },
  ]

  const languages = [
    { value: 'es-419', label: 'Español (América Latina)' },
    { value: 'es-MX', label: 'Español (México)' },
    { value: 'es-CO', label: 'Español (Colombia)' },
    { value: 'es-CL', label: 'Español (Chile)' },
    { value: 'es-PE', label: 'Español (Perú)' },
    { value: 'es-AR', label: 'Español (Argentina)' },
    { value: 'es-DO', label: 'Español (República Dominicana)' },
    { value: 'en-US', label: 'English (United States)' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{navT('accountSettings')}</h1>
        <p className="text-muted-foreground">
          Gestiona la configuración de tu cuenta y preferencias.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
            <CardDescription>
              Actualiza tu información personal y datos de contacto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input 
                id="name" 
                defaultValue="Admin User" 
                placeholder="Tu nombre completo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email"
                defaultValue="admin@agentevirtualia.com" 
                placeholder="tu.correo@empresa.com"
              />
            </div>
            <Button>Guardar Cambios</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription>
              Gestiona tu contraseña y configuración de seguridad.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Contraseña Actual</Label>
              <Input 
                id="current-password" 
                type="password"
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <Input 
                id="new-password" 
                type="password"
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
              <Input 
                id="confirm-password" 
                type="password"
                placeholder="••••••••"
              />
            </div>
            <Button>Actualizar Contraseña</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
            <CardDescription>
              Personaliza tu experiencia en la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tu zona horaria" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {tz.country}
                        </span>
                        {tz.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentTime && (
                <p className="text-sm text-muted-foreground mt-1">
                  Hora actual: <span className="font-medium">{currentTime}</span>
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="language">Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tu idioma preferido" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button>Guardar Preferencias</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}