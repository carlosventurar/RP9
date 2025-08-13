'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface WorkflowCostData {
  workflow_id: string;
  workflow_name: string;
  cost_usd: number;
  execution_count: number;
  avg_cost: number;
}

interface TopWorkflowsCostProps {
  data: WorkflowCostData[];
}

export function TopWorkflowsCost({ data }: TopWorkflowsCostProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(value);
  };

  const getColorByEfficiency = (avgCost: number) => {
    if (avgCost <= 0.01) return '#10b981'; // Verde - Muy eficiente
    if (avgCost <= 0.05) return '#f59e0b'; // Amarillo - Moderado
    if (avgCost <= 0.10) return '#f97316'; // Naranja - Alto
    return '#ef4444'; // Rojo - Muy alto
  };

  const chartData = data.map(item => ({
    ...item,
    display_name: item.workflow_name.length > 20 
      ? item.workflow_name.substring(0, 20) + '...'
      : item.workflow_name
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">💰</div>
          <p>No hay datos de costos de workflows disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Gráfico de barras */}
      <div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="display_name" 
              stroke="#666"
              fontSize={11}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="#666"
              fontSize={12}
              tickFormatter={formatCurrency}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'Costo Total']}
              labelFormatter={(label) => {
                const item = data.find(d => d.workflow_name.startsWith(label.replace('...', '')));
                return item ? item.workflow_name : label;
              }}
              contentStyle={{ 
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Bar dataKey="cost_usd" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColorByEfficiency(entry.avg_cost)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla detallada */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium">Workflow</th>
              <th className="text-center p-3 font-medium">Costo Total</th>
              <th className="text-center p-3 font-medium">Ejecuciones</th>
              <th className="text-center p-3 font-medium">Costo Promedio</th>
              <th className="text-center p-3 font-medium">Eficiencia</th>
            </tr>
          </thead>
          <tbody>
            {data.map((workflow, index) => (
              <tr key={workflow.workflow_id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div>
                    <div className="font-medium text-gray-900">
                      {workflow.workflow_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {workflow.workflow_id}
                    </div>
                  </div>
                </td>
                <td className="text-center p-3">
                  <span className="font-bold text-lg">
                    {formatCurrency(workflow.cost_usd)}
                  </span>
                </td>
                <td className="text-center p-3">
                  <span className="font-medium">
                    {workflow.execution_count.toLocaleString()}
                  </span>
                </td>
                <td className="text-center p-3">
                  <span 
                    className="font-medium px-2 py-1 rounded text-white text-xs"
                    style={{ backgroundColor: getColorByEfficiency(workflow.avg_cost) }}
                  >
                    {formatCurrency(workflow.avg_cost)}
                  </span>
                </td>
                <td className="text-center p-3">
                  <div className="flex items-center justify-center">
                    {workflow.avg_cost <= 0.01 && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                        ⭐ Excelente
                      </span>
                    )}
                    {workflow.avg_cost > 0.01 && workflow.avg_cost <= 0.05 && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                        ✅ Bueno
                      </span>
                    )}
                    {workflow.avg_cost > 0.05 && workflow.avg_cost <= 0.10 && (
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                        ⚠️ Alto
                      </span>
                    )}
                    {workflow.avg_cost > 0.10 && (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                        🚨 Crítico
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen y recomendaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">📊 Resumen de Costos</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>Costo Total:</strong> {formatCurrency(data.reduce((sum, w) => sum + w.cost_usd, 0))}</p>
            <p>• <strong>Ejecuciones Total:</strong> {data.reduce((sum, w) => sum + w.execution_count, 0).toLocaleString()}</p>
            <p>• <strong>Costo Promedio Global:</strong> {formatCurrency(data.reduce((sum, w) => sum + w.cost_usd, 0) / data.reduce((sum, w) => sum + w.execution_count, 0))}</p>
            <p>• <strong>Workflow Más Costoso:</strong> {data[0]?.workflow_name}</p>
          </div>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg">
          <h4 className="font-medium text-orange-800 mb-2">🎯 Oportunidades de Optimización</h4>
          <div className="text-sm text-orange-700 space-y-1">
            {data.filter(w => w.avg_cost > 0.10).length > 0 && (
              <p>• <strong>{data.filter(w => w.avg_cost > 0.10).length}</strong> workflows con costo >$0.10 por ejecución</p>
            )}
            {data.filter(w => w.execution_count > 1000 && w.avg_cost > 0.05).length > 0 && (
              <p>• <strong>{data.filter(w => w.execution_count > 1000 && w.avg_cost > 0.05).length}</strong> workflows de alto volumen y costo</p>
            )}
            <p>• Revisar workflows naranjas/rojos para optimización</p>
            <p>• Implementar cache en workflows con muchas llamadas API</p>
          </div>
        </div>
      </div>

      {/* Leyenda de eficiencia */}
      <div className="flex flex-wrap items-center justify-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-700">Leyenda de Eficiencia:</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
          <span className="text-xs">≤ $0.01 (Excelente)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
          <span className="text-xs">$0.01-$0.05 (Bueno)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></div>
          <span className="text-xs">$0.05-$0.10 (Alto)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
          <span className="text-xs">>$0.10 (Crítico)</span>
        </div>
      </div>
    </div>
  );
}