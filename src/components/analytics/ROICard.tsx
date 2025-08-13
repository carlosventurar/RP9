'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface ROIData {
  month: string;
  roi_usd: number;
  hours_saved: number;
  cost_usd: number;
}

interface ROICardProps {
  data: ROIData[];
}

export function ROICard({ data }: ROICardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatTooltip = (value: number, name: string) => {
    if (name === 'ROI Neto') return [formatCurrency(value), name];
    if (name === 'Valor Ahorros') return [formatCurrency(value * 50), 'Valor Ahorros']; // horas × $50
    if (name === 'Costos') return [formatCurrency(value), name];
    return [value, name];
  };

  const chartData = data.map(item => ({
    month: item.month,
    'ROI Neto': item.roi_usd,
    'Valor Ahorros': item.hours_saved * 50, // Convertir horas a USD
    'Costos': item.cost_usd
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No hay datos disponibles para mostrar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="month" 
            stroke="#666"
            fontSize={12}
          />
          <YAxis 
            stroke="#666"
            fontSize={12}
            tickFormatter={formatCurrency}
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
            dataKey="Valor Ahorros" 
            fill="#10b981" 
            name="Valor Ahorros"
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="Costos" 
            fill="#ef4444" 
            name="Costos"
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="ROI Neto" 
            fill="#3b82f6" 
            name="ROI Neto"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center p-2 bg-green-50 rounded">
          <div className="font-medium text-green-700">💰 Valor Total Ahorrado</div>
          <div className="text-lg font-bold text-green-600">
            {formatCurrency(chartData.reduce((sum, item) => sum + item['Valor Ahorros'], 0))}
          </div>
        </div>
        <div className="text-center p-2 bg-red-50 rounded">
          <div className="font-medium text-red-700">💸 Costo Total</div>
          <div className="text-lg font-bold text-red-600">
            {formatCurrency(chartData.reduce((sum, item) => sum + item['Costos'], 0))}
          </div>
        </div>
        <div className="text-center p-2 bg-blue-50 rounded">
          <div className="font-medium text-blue-700">🎯 ROI Neto Total</div>
          <div className="text-lg font-bold text-blue-600">
            {formatCurrency(chartData.reduce((sum, item) => sum + item['ROI Neto'], 0))}
          </div>
        </div>
      </div>
    </div>
  );
}