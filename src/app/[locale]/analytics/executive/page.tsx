'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Clock, Users, Target } from 'lucide-react';
import { ROICard } from '@/components/analytics/ROICard';
import { TTVCohorts } from '@/components/analytics/TTVCohorts';
import { AdoptionByPack } from '@/components/analytics/AdoptionByPack';

interface ExecutiveKPIs {
  roi_usd: number;
  roi_trend: number;
  ttv_days_avg: number;
  ttv_trend: number;
  adoption_rate: number;
  adoption_trend: number;
  hours_saved_total: number;
  hours_saved_trend: number;
  cohort_ttv: Array<{
    week: string;
    signups: number;
    ttv_achieved: number;
    ttv_rate: number;
    avg_days: number;
  }>;
  roi_breakdown: Array<{
    month: string;
    roi_usd: number;
    hours_saved: number;
    cost_usd: number;
  }>;
}

type Period = '7d' | '30d' | '90d' | '12m';

export default function ExecutiveDashboard() {
  const t = useTranslations();
  const [period, setPeriod] = useState<Period>('30d');
  const [kpis, setKpis] = useState<ExecutiveKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKPIs();
  }, [period]);

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/analytics/kpis?dashboard=executive&period=${period}`);
      if (!response.ok) {
        throw new Error('Error al cargar métricas');
      }

      const data = await response.json();
      setKpis(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
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
          <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
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
          <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="text-lg font-medium">Error al cargar datos</p>
              <p className="text-sm text-gray-600 mt-1">{error}</p>
              <button
                onClick={fetchKPIs}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
          <p className="text-gray-600">
            North Star Metric: ROI en USD/mes • {getPeriodLabel(period)}
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
            <CardTitle className="text-sm font-medium">ROI Mensual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.roi_usd)}</div>
            {formatTrend(kpis.roi_trend)}
            <p className="text-xs text-muted-foreground mt-1">
              North Star Metric
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time To Value</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.ttv_days_avg > 0 ? `${kpis.ttv_days_avg.toFixed(1)} días` : 'N/A'}
            </div>
            {formatTrend(kpis.ttv_trend)}
            <p className="text-xs text-muted-foreground mt-1">
              Tiempo hasta primera victoria
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Adopción</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.adoption_rate.toFixed(1)}%</div>
            {formatTrend(kpis.adoption_trend)}
            <p className="text-xs text-muted-foreground mt-1">
              Usuarios con primera ejecución
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Ahorradas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.hours_saved_total.toLocaleString()}
            </div>
            {formatTrend(kpis.hours_saved_trend)}
            <p className="text-xs text-muted-foreground mt-1">
              Total en el período
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="roi" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roi">ROI Breakdown</TabsTrigger>
          <TabsTrigger value="ttv">Cohorts TTV</TabsTrigger>
          <TabsTrigger value="adoption">Adopción por Pack</TabsTrigger>
        </TabsList>

        <TabsContent value="roi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ROI Mensual Breakdown</CardTitle>
              <CardDescription>
                Desglose del ROI mostrando ahorros vs. costos de plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ROICard data={kpis.roi_breakdown} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ttv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Cohorts - Time To Value</CardTitle>
              <CardDescription>
                Seguimiento semanal de tiempo hasta primera victoria por cohorte de signup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TTVCohorts data={kpis.cohort_ttv} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adoption" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adopción por Pack de Templates</CardTitle>
              <CardDescription>
                Métricas de adopción y success rate por categoría de templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdoptionByPack />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Quality Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600 border-green-600">
                ● Datos actualizados
              </Badge>
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