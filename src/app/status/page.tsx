'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

interface HealthCheck {
  ok: boolean;
  checks: {
    n8n?: { status: boolean; error?: string; responseTime?: number };
    supabase?: { status: boolean; error?: string; responseTime?: number };
  };
  system: {
    timestamp: string;
    environment: string;
    version: string;
  };
  uptime?: number;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/healthcheck');
      const data = await response.json();
      setHealth(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching health:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean) => {
    return (
      <Badge variant={status ? "default" : "destructive"}>
        {status ? "Operativo" : "Degradado"}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Estado del Sistema RP9
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitoreo en tiempo real de nuestros servicios
          </p>
        </div>

        {/* Overall Status */}
        <Card className="mb-8 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {health?.ok ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
              <div>
                <h2 className="text-xl font-semibold">
                  {health?.ok ? "Todos los sistemas operativos" : "Algunos sistemas con problemas"}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {lastUpdated && `Última actualización: ${lastUpdated.toLocaleString('es-ES')}`}
                </p>
              </div>
            </div>
            <Button 
              onClick={fetchHealth} 
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </Card>

        {/* Services Status */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* n8n Service */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(health?.checks?.n8n?.status ?? false)}
                <h3 className="font-semibold">Motor de Automatización (n8n)</h3>
              </div>
              {getStatusBadge(health?.checks?.n8n?.status ?? false)}
            </div>
            
            <div className="space-y-2 text-sm">
              {health?.checks?.n8n?.responseTime && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  Tiempo de respuesta: {health.checks.n8n.responseTime}ms
                </div>
              )}
              {health?.checks?.n8n?.error && (
                <div className="text-red-600 dark:text-red-400">
                  Error: {health.checks.n8n.error}
                </div>
              )}
              <p className="text-gray-600 dark:text-gray-400">
                Procesa workflows y automatizaciones
              </p>
            </div>
          </Card>

          {/* Supabase Service */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(health?.checks?.supabase?.status ?? false)}
                <h3 className="font-semibold">Base de Datos (Supabase)</h3>
              </div>
              {getStatusBadge(health?.checks?.supabase?.status ?? false)}
            </div>
            
            <div className="space-y-2 text-sm">
              {health?.checks?.supabase?.responseTime && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  Tiempo de respuesta: {health.checks.supabase.responseTime}ms
                </div>
              )}
              {health?.checks?.supabase?.error && (
                <div className="text-red-600 dark:text-red-400">
                  Error: {health.checks.supabase.error}
                </div>
              )}
              <p className="text-gray-600 dark:text-gray-400">
                Almacena datos y gestiona autenticación
              </p>
            </div>
          </Card>
        </div>

        {/* System Information */}
        {health?.system && (
          <Card className="mt-8 p-6">
            <h3 className="font-semibold mb-4">Información del Sistema</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Entorno</p>
                <p className="font-medium">{health.system.environment}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Versión</p>
                <p className="font-medium">{health.system.version}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tiempo Activo</p>
                <p className="font-medium">
                  {health.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : 'N/A'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600 dark:text-gray-400">
          <p>¿Experimentas problemas? Contacta soporte en support@rp9.com</p>
        </div>
      </div>
    </div>
  );
}