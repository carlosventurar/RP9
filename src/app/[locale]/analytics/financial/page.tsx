'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calculator,
  AlertTriangle,
  PiggyBank,
  Target,
  Zap
} from 'lucide-react';
import { TopWorkflowsCost } from '@/components/analytics/TopWorkflowsCost';

interface FinancialKPIs {
  cost_total_usd: number;
  cost_trend: number;
  cost_per_execution: number;
  cost_efficiency_trend: number;
  overage_risk: number;
  top_cost_workflows: Array<{
    workflow_id: string;
    workflow_name: string;
    cost_usd: number;
    execution_count: number;
    avg_cost: number;
  }>;
  cost_breakdown_daily: Array<{
    date: string;
    cost_usd: number;
    execution_count: number;
    avg_cost: number;
  }>;
  savings_vs_cost: {
    hours_saved_value_usd: number;
    platform_cost_usd: number;
    net_savings_usd: number;
    savings_multiple: number;
  };
}

type Period = '7d' | '30d' | '90d' | '12m';

export default function FinancialDashboard() {
  const t = useTranslations();
  const [period, setPeriod] = useState<Period>('30d');
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKPIs();
  }, [period]);

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/analytics/kpis?dashboard=financial&period=${period}`);
      if (!response.ok) {
        throw new Error('Error al cargar métricas financieras');
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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

  const getOverageRiskBadge = (risk: number) => {
    if (risk < 20) return <Badge className="bg-green-100 text-green-800">Bajo</Badge>;
    if (risk < 50) return <Badge className="bg-yellow-100 text-yellow-800">Medio</Badge>;
    if (risk < 80) return <Badge className="bg-orange-100 text-orange-800">Alto</Badge>;
    return <Badge className="bg-red-100 text-red-800">Crítico</Badge>;
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
          <h1 className="text-3xl font-bold">Dashboard Financiero</h1>
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
          <h1 className="text-3xl font-bold">Dashboard Financiero</h1>
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
          <h1 className="text-3xl font-bold">Dashboard Financiero</h1>
          <p className="text-gray-600">
            Análisis de costos, eficiencia y ROI financiero • {getPeriodLabel(period)}
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
            <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.cost_total_usd)}</div>
            {formatTrend(kpis.cost_trend)}
            <p className="text-xs text-muted-foreground mt-1">
              Gasto en plataforma
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo por Ejecución</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.cost_per_execution)}</div>
            {formatTrend(kpis.cost_efficiency_trend)}
            <p className="text-xs text-muted-foreground mt-1">
              Eficiencia promedio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Riesgo Overage</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.overage_risk.toFixed(0)}%</div>
            <div className="mt-2">
              {getOverageRiskBadge(kpis.overage_risk)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Probabilidad exceso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI Múltiplo</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {kpis.savings_vs_cost.savings_multiple.toFixed(1)}x
            </div>
            <div className="text-xs text-green-600 font-medium mt-1">
              Ahorros vs Costos
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Múltiplo de retorno
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Savings vs Cost Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Análisis Ahorros vs Costos
          </CardTitle>
          <CardDescription>
            Comparación entre valor generado por la plataforma y costos operacionales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {formatCurrency(kpis.savings_vs_cost.hours_saved_value_usd)}
              </div>
              <p className="text-sm font-medium text-green-700">Valor Ahorros</p>
              <p className="text-xs text-green-600 mt-1">
                Horas ahorradas × $50/hora
              </p>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {formatCurrency(kpis.savings_vs_cost.platform_cost_usd)}
              </div>
              <p className="text-sm font-medium text-red-700">Costo Plataforma</p>
              <p className="text-xs text-red-600 mt-1">
                Ejecuciones + infraestructura
              </p>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatCurrency(kpis.savings_vs_cost.net_savings_usd)}
              </div>
              <p className="text-sm font-medium text-blue-700">Ahorro Neto</p>
              <p className="text-xs text-blue-600 mt-1">
                {kpis.savings_vs_cost.savings_multiple.toFixed(1)}x retorno
              </p>
            </div>
          </div>

          {kpis.savings_vs_cost.net_savings_usd < 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atención:</strong> Los costos superan a los ahorros en este período. 
                Revisar eficiencia de workflows y optimizar ejecuciones.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Charts and Tables */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Tendencias Diarias</TabsTrigger>
          <TabsTrigger value="workflows">Top Workflows</TabsTrigger>
          <TabsTrigger value="optimization">Optimización</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolución Diaria de Costos</CardTitle>
              <CardDescription>
                Seguimiento diario de gastos y eficiencia por ejecución
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpis.cost_breakdown_daily.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-2" />
                    <p>No hay datos de costos para el período seleccionado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-600 border-b pb-2">
                      <div>Fecha</div>
                      <div className="text-center">Costo Total</div>
                      <div className="text-center">Ejecuciones</div>
                      <div className="text-center">Costo Promedio</div>
                    </div>
                    {kpis.cost_breakdown_daily.slice(-10).map((day) => (
                      <div key={day.date} className="grid grid-cols-4 gap-4 p-3 border rounded">
                        <div className="font-medium">{day.date}</div>
                        <div className="text-center font-bold">
                          {formatCurrency(day.cost_usd)}
                        </div>
                        <div className="text-center">{day.execution_count}</div>
                        <div className="text-center">
                          {formatCurrency(day.avg_cost)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflows Más Costosos</CardTitle>
              <CardDescription>
                Identificación de workflows que consumen más recursos y presupuesto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopWorkflowsCost data={kpis.top_cost_workflows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recomendaciones de Optimización</CardTitle>
              <CardDescription>
                Sugerencias para reducir costos y mejorar eficiencia financiera
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpis.cost_per_execution > 0.10 && (
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Costo Alto por Ejecución:</strong> ${kpis.cost_per_execution.toFixed(3)} 
                      está por encima del benchmark ($0.10). Considerar optimizar workflows complejos.
                    </AlertDescription>
                  </Alert>
                )}

                {kpis.overage_risk > 70 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Alto Riesgo de Overage:</strong> {kpis.overage_risk.toFixed(0)}% 
                      probabilidad de exceder límites. Implementar alertas y controles.
                    </AlertDescription>
                  </Alert>
                )}

                {kpis.savings_vs_cost.savings_multiple < 2 && (
                  <Alert>
                    <Target className="h-4 w-4" />
                    <AlertDescription>
                      <strong>ROI Bajo:</strong> Múltiplo de {kpis.savings_vs_cost.savings_multiple.toFixed(1)}x 
                      está debajo del target (2x). Revisar templates de alto impacto.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">💡 Tips de Optimización</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Revisar workflows con >1000 ejecuciones/día para optimización</li>
                    <li>• Implementar cache para reducir llamadas API externas</li>
                    <li>• Usar templates de batch processing para operaciones masivas</li>
                    <li>• Monitorear P95 de tiempo de ejecución para detectar ineficiencias</li>
                  </ul>
                </div>
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
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                ● Datos financieros actualizados
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