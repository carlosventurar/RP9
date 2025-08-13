'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, Bar } from 'recharts';

interface TTVCohortData {
  week: string;
  signups: number;
  ttv_achieved: number;
  ttv_rate: number;
  avg_days: number;
}

interface TTVCohortsProps {
  data: TTVCohortData[];
}

export function TTVCohorts({ data }: TTVCohortsProps) {
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatDays = (value: number) => `${value.toFixed(1)} días`;

  const formatTooltip = (value: number, name: string) => {
    if (name === 'Tasa TTV') return [formatPercent(value), name];
    if (name === 'Días Promedio') return [formatDays(value), name];
    if (name === 'Signups' || name === 'TTV Logrados') return [value.toLocaleString(), name];
    return [value, name];
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">⏱️</div>
          <p>No hay datos de cohorts TTV disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Gráfico principal: TTV Rate y Average Days */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Tasa de TTV y Tiempo Promedio por Cohorte</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="week" 
              stroke="#666"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="rate"
              orientation="left"
              stroke="#666"
              fontSize={12}
              tickFormatter={formatPercent}
            />
            <YAxis 
              yAxisId="days"
              orientation="right"
              stroke="#666"
              fontSize={12}
              tickFormatter={formatDays}
            />
            <Tooltip 
              formatter={formatTooltip}
              labelStyle={{ color: '#333' }}
              contentStyle={{ 
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend />
            <Line 
              yAxisId="rate"
              type="monotone" 
              dataKey="ttv_rate" 
              stroke="#10b981" 
              strokeWidth={3}
              name="Tasa TTV"
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            />
            <Line 
              yAxisId="days"
              type="monotone" 
              dataKey="avg_days" 
              stroke="#f59e0b" 
              strokeWidth={3}
              name="Días Promedio"
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de barras: Signups vs TTV Achieved */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Signups vs TTV Logrados por Semana</h4>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="week" 
              stroke="#666"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#666"
              fontSize={12}
            />
            <Tooltip 
              formatter={formatTooltip}
              labelStyle={{ color: '#333' }}
              contentStyle={{ 
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend />
            <Bar 
              dataKey="signups" 
              fill="#3b82f6" 
              name="Signups"
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="ttv_achieved" 
              fill="#10b981" 
              name="TTV Logrados"
              radius={[2, 2, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Métricas resumidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="text-center p-3 bg-blue-50 rounded">
          <div className="font-medium text-blue-700">👥 Total Signups</div>
          <div className="text-xl font-bold text-blue-600">
            {data.reduce((sum, item) => sum + item.signups, 0).toLocaleString()}
          </div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded">
          <div className="font-medium text-green-700">✅ TTV Logrados</div>
          <div className="text-xl font-bold text-green-600">
            {data.reduce((sum, item) => sum + item.ttv_achieved, 0).toLocaleString()}
          </div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded">
          <div className="font-medium text-purple-700">📊 Tasa TTV Global</div>
          <div className="text-xl font-bold text-purple-600">
            {data.length > 0 
              ? ((data.reduce((sum, item) => sum + item.ttv_achieved, 0) / 
                  data.reduce((sum, item) => sum + item.signups, 0)) * 100).toFixed(1)
              : 0}%
          </div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded">
          <div className="font-medium text-orange-700">⏱️ TTV Promedio</div>
          <div className="text-xl font-bold text-orange-600">
            {data.length > 0 
              ? (data.reduce((sum, item) => sum + item.avg_days, 0) / data.length).toFixed(1)
              : 0} días
          </div>
        </div>
      </div>

      {/* Insights automáticos */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-2">📈 Insights Automáticos</h4>
        <div className="text-sm text-gray-600 space-y-1">
          {data.length > 1 && (
            <>
              {data[data.length - 1].ttv_rate > data[data.length - 2].ttv_rate ? (
                <p>• ✅ La tasa de TTV está mejorando en las últimas semanas</p>
              ) : (
                <p>• ⚠️ La tasa de TTV ha disminuido recientemente, revisar onboarding</p>
              )}
              
              {data[data.length - 1].avg_days < data[data.length - 2].avg_days ? (
                <p>• 🚀 El tiempo promedio para TTV está reduciéndose</p>
              ) : (
                <p>• 🐌 El tiempo promedio para TTV está aumentando</p>
              )}
            </>
          )}
          
          {data.some(d => d.ttv_rate > 80) && (
            <p>• 🎯 Excelente: Algunas cohortes superan 80% de tasa TTV</p>
          )}
          
          {data.some(d => d.avg_days > 14) && (
            <p>• ⏰ Oportunidad: Algunas cohortes tardan &gt;14 días en TTV</p>
          )}
        </div>
      </div>
    </div>
  );
}