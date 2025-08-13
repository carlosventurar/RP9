'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { DataHealth } from '@/components/analytics/DataHealth';

interface OperationsKPIs {
  success_rate: number;
  success_trend: number;
  error_rate: number;
  error_trend: number;
  p95_execution_time: number;
  p95_trend: number;
  data_freshness_score: number;
  executions_daily: Array<{
    date: string;
    total: number;
    success: number;
    errors: number;
    p95_time: number;
  }>;
  top_error_templates: Array<{
    template_id: string;
    template_name: string;
    error_count: number;
    error_rate: number;
  }>;
  funnel_conversion: {
    wizard_starts: number;
    template_installs: number;
    first_executions: number;
    first_successes: number;
    conversion_rate: number;
  };
}

type Period = '7d' | '30d' | '90d' | '12m';

export default function OperationsDashboard() {
  const t = useTranslations();
  const [period, setPeriod] = useState<Period>('30d');
  const [kpis, setKpis] = useState<OperationsKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKPIs();
  }, [period]);

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/analytics/kpis?dashboard=operations&period=${period}`);
      if (!response.ok) {
        throw new Error('Error al cargar métricas operacionales');
      }

      const data = await response.json();
      setKpis(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const formatTrend = (trend: number) => {
    const isPositive = trend >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    
    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">
          {isPositive ? '+' : ''}{trend.toFixed(1)}%
        </span>
      </div>
    );
  };

  const getHealthBadge = (score: number) => {
    if (score >= 95) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    if (score >= 85) return <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>;
    if (score >= 70) return <Badge className="bg-orange-100 text-orange-800">Regular</Badge>;
    return <Badge className="bg-red-100 text-red-800">Crítico</Badge>;
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const getPeriodLabel = (period: Period) => {
    const labels = {
      '7d': 'Últimos 7 días',
      '30d': 'Últimos 30 días', 
      '90d': 'Últimos 90 días',
      '12m': 'Últimos 12 meses'
    };
    return labels[period];
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard Operacional</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard Operacional</h1>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <button
              onClick={fetchKPIs}
              className="ml-2 underline hover:no-underline"
            >
              Reintentar
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Operacional</h1>
          <p className="text-gray-600">
            Monitoreo de salud, performance y conversión • {getPeriodLabel(period)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={(value: Period) => setPeriod(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="12m">12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {kpis.success_rate.toFixed(1)}%
            </div>
            {formatTrend(kpis.success_trend)}
            <Progress value={kpis.success_rate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Error</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {kpis.error_rate.toFixed(1)}%
            </div>
            {formatTrend(kpis.error_trend)}
            <Progress value={kpis.error_rate} className="mt-2 [&>div]:bg-red-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Tiempo Ejecución</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatExecutionTime(kpis.p95_execution_time)}
            </div>
            {formatTrend(kpis.p95_trend)}
            <p className="text-xs text-muted-foreground mt-1">
              95% de ejecuciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calidad de Datos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.data_freshness_score}%</div>
            <div className="mt-2">
              {getHealthBadge(kpis.data_freshness_score)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Frescura de datos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Conversion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Embudo de Conversión
          </CardTitle>
          <CardDescription>
            Seguimiento del journey desde wizard hasta primera ejecución exitosa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {kpis.funnel_conversion.wizard_starts.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Wizard Iniciados</p>
              <div className="text-xs text-gray-500 mt-1">100%</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {kpis.funnel_conversion.template_installs.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Templates Instalados</p>
              <div className="text-xs text-gray-500 mt-1">
                {kpis.funnel_conversion.wizard_starts > 0 
                  ? ((kpis.funnel_conversion.template_installs / kpis.funnel_conversion.wizard_starts) * 100).toFixed(1)
                  : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {kpis.funnel_conversion.first_executions.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Primeras Ejecuciones</p>
              <div className="text-xs text-gray-500 mt-1">
                {kpis.funnel_conversion.wizard_starts > 0 
                  ? ((kpis.funnel_conversion.first_executions / kpis.funnel_conversion.wizard_starts) * 100).toFixed(1)
                  : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {kpis.funnel_conversion.first_successes.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Primeros Éxitos</p>
              <div className="text-xs text-green-600 font-medium mt-1">
                {kpis.funnel_conversion.conversion_rate.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts and Tables */}
      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">Salud del Sistema</TabsTrigger>
          <TabsTrigger value="errors">Top Errores</TabsTrigger>
          <TabsTrigger value="performance">Performance Diaria</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoreo de Salud del Sistema</CardTitle>
              <CardDescription>
                Métricas de latencia, disponibilidad y calidad de datos en tiempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataHealth 
                successRate={kpis.success_rate}
                p95Time={kpis.p95_execution_time}
                dataScore={kpis.data_freshness_score}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates con Más Errores</CardTitle>
              <CardDescription>
                Identificación de templates problemáticos que requieren atención
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpis.top_error_templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>¡Excelente! No hay templates con errores significativos</p>
                  </div>
                ) : (
                  kpis.top_error_templates.map((template, idx) => (
                    <div 
                      key={template.template_id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-red-600 font-medium">{idx + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{template.template_name}</p>
                          <p className="text-sm text-gray-600">ID: {template.template_id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">
                          {template.error_count} errores
                        </div>
                        <div className="text-sm text-gray-600">
                          {template.error_rate.toFixed(1)}% tasa de error
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Diaria</CardTitle>
              <CardDescription>
                Evolución diaria de ejecuciones, éxitos, errores y tiempos P95
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpis.executions_daily.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-2" />
                    <p>No hay datos de performance para el período seleccionado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kpis.executions_daily.slice(-7).map((day) => (
                      <div key={day.date} className="grid grid-cols-5 gap-4 p-3 border rounded">
                        <div>
                          <p className="text-sm font-medium">{day.date}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold">{day.total}</p>
                          <p className="text-xs text-gray-600">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">{day.success}</p>
                          <p className="text-xs text-gray-600">Éxitos</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">{day.errors}</p>
                          <p className="text-xs text-gray-600">Errores</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold">{formatExecutionTime(day.p95_time)}</p>
                          <p className="text-xs text-gray-600">P95</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Quality Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getHealthBadge(kpis.data_freshness_score)}
              <span className="text-sm text-gray-600">
                Última actualización: {new Date().toLocaleString('es-AR')}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Período: {getPeriodLabel(period)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}