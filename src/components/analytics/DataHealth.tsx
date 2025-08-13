'use client';

import { ResponsiveContainer, RadialBarChart, RadialBar, ResponsiveContainerProps } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface DataHealthProps {
  successRate: number;
  p95Time: number;
  dataScore: number;
}

export function DataHealth({ successRate, p95Time, dataScore }: DataHealthProps) {
  // Calcular score general de salud del sistema
  const overallHealth = Math.round((successRate + dataScore + Math.max(0, 100 - (p95Time / 1000))) / 3);

  const getHealthColor = (score: number) => {
    if (score >= 95) return '#10b981'; // Verde
    if (score >= 85) return '#f59e0b'; // Amarillo
    if (score >= 70) return '#f97316'; // Naranja
    return '#ef4444'; // Rojo
  };

  const getHealthLabel = (score: number) => {
    if (score >= 95) return 'Excelente';
    if (score >= 85) return 'Bueno';
    if (score >= 70) return 'Regular';
    return 'Crítico';
  };

  const getHealthBadge = (score: number) => {
    if (score >= 95) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    if (score >= 85) return <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>;
    if (score >= 70) return <Badge className="bg-orange-100 text-orange-800">Regular</Badge>;
    return <Badge className="bg-red-100 text-red-800">Crítico</Badge>;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  // Datos para el gráfico radial
  const healthData = [
    {
      name: 'Salud General',
      value: overallHealth,
      fill: getHealthColor(overallHealth)
    }
  ];

  return (
    <div className="w-full space-y-6">
      {/* Gráfico radial de salud general */}
      <div className="flex flex-col lg:flex-row items-center gap-6">
        <div className="w-64 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              innerRadius="60%" 
              outerRadius="80%" 
              data={healthData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar 
                dataKey="value" 
                cornerRadius={10}
                fill={healthData[0].fill}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-32">
            <div className="text-4xl font-bold" style={{ color: healthData[0].fill }}>
              {overallHealth}%
            </div>
            <div className="text-lg font-medium text-gray-700">
              {getHealthLabel(overallHealth)}
            </div>
            <div className="text-sm text-gray-500">
              Salud del Sistema
            </div>
          </div>
        </div>

        {/* Métricas individuales */}
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {successRate.toFixed(1)}%
              </div>
              <div className="text-sm font-medium text-gray-700">Tasa de Éxito</div>
              <Progress value={successRate} className="mt-2" />
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatTime(p95Time)}
              </div>
              <div className="text-sm font-medium text-gray-700">P95 Tiempo</div>
              <Progress 
                value={Math.max(0, 100 - (p95Time / 1000))} 
                className="mt-2 [&>div]:bg-blue-500" 
              />
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {dataScore}%
              </div>
              <div className="text-sm font-medium text-gray-700">Calidad Datos</div>
              <Progress 
                value={dataScore} 
                className="mt-2 [&>div]:bg-purple-500" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores de estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Disponibilidad</span>
            {getHealthBadge(successRate)}
          </div>
          <div className="text-xs text-gray-600">
            {successRate >= 99.9 ? 'SLA cumplido' : 'Por debajo del SLA'}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Performance</span>
            {getHealthBadge(Math.max(0, 100 - (p95Time / 1000)))}
          </div>
          <div className="text-xs text-gray-600">
            {p95Time < 5000 ? 'Excelente latencia' : 'Latencia alta'}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Datos</span>
            {getHealthBadge(dataScore)}
          </div>
          <div className="text-xs text-gray-600">
            {dataScore >= 95 ? 'Datos frescos' : 'Lag detectado'}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">General</span>
            {getHealthBadge(overallHealth)}
          </div>
          <div className="text-xs text-gray-600">
            Score promedio: {overallHealth}%
          </div>
        </div>
      </div>

      {/* Alertas y recomendaciones */}
      <div className="space-y-3">
        {successRate < 95 && (
          <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
            <div className="text-sm">
              <strong className="text-red-800">⚠️ Alerta Crítica:</strong>
              <span className="text-red-700 ml-1">
                Tasa de éxito {successRate.toFixed(1)}% está por debajo del umbral de 95%. 
                Revisar logs de errores inmediatamente.
              </span>
            </div>
          </div>
        )}

        {p95Time > 10000 && (
          <div className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded">
            <div className="text-sm">
              <strong className="text-orange-800">⏱️ Performance:</strong>
              <span className="text-orange-700 ml-1">
                P95 de {formatTime(p95Time)} excede el SLA de 10s. 
                Optimizar workflows más lentos.
              </span>
            </div>
          </div>
        )}

        {dataScore < 90 && (
          <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <div className="text-sm">
              <strong className="text-yellow-800">📊 Calidad Datos:</strong>
              <span className="text-yellow-700 ml-1">
                Score de calidad {dataScore}% indica lag en recolección. 
                Verificar procesos ETL.
              </span>
            </div>
          </div>
        )}

        {overallHealth >= 95 && (
          <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
            <div className="text-sm">
              <strong className="text-green-800">✅ Excelente:</strong>
              <span className="text-green-700 ml-1">
                Todos los sistemas operando dentro de SLA. Sistema saludable.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="text-xs text-gray-500 text-center">
        Última verificación: {new Date().toLocaleString('es-AR')}
      </div>
    </div>
  );
}