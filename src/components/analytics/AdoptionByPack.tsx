'use client';

import { useState, useEffect } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PackAdoptionData {
  pack_name: string;
  category: string;
  installs: number;
  active_users: number;
  success_rate: number;
  avg_outcomes_per_user: number;
  total_hours_saved: number;
  adoption_rate: number;
}

export function AdoptionByPack() {
  const [data, setData] = useState<PackAdoptionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular datos hasta que la API esté conectada
    const mockData: PackAdoptionData[] = [
      {
        pack_name: 'Finanzas & Contabilidad',
        category: 'finance',
        installs: 1250,
        active_users: 980,
        success_rate: 92.5,
        avg_outcomes_per_user: 8.3,
        total_hours_saved: 2840,
        adoption_rate: 78.4
      },
      {
        pack_name: 'CRM & Ventas',
        category: 'sales',
        installs: 890,
        active_users: 720,
        success_rate: 87.2,
        avg_outcomes_per_user: 6.1,
        total_hours_saved: 1960,
        adoption_rate: 80.9
      },
      {
        pack_name: 'Marketing Digital',
        category: 'marketing',
        installs: 740,
        active_users: 580,
        success_rate: 84.6,
        avg_outcomes_per_user: 5.8,
        total_hours_saved: 1520,
        adoption_rate: 78.4
      },
      {
        pack_name: 'Recursos Humanos',
        category: 'hr',
        installs: 620,
        active_users: 450,
        success_rate: 89.1,
        avg_outcomes_per_user: 4.2,
        total_hours_saved: 980,
        adoption_rate: 72.6
      },
      {
        pack_name: 'Operaciones & Logística',
        category: 'operations',
        installs: 480,
        active_users: 340,
        success_rate: 91.3,
        avg_outcomes_per_user: 7.1,
        total_hours_saved: 1240,
        adoption_rate: 70.8
      },
      {
        pack_name: 'E-commerce',
        category: 'ecommerce',
        installs: 350,
        active_users: 280,
        success_rate: 86.7,
        avg_outcomes_per_user: 5.5,
        total_hours_saved: 760,
        adoption_rate: 80.0
      }
    ];

    setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 500);
  }, []);

  const COLORS = [
    '#10b981', // Verde
    '#3b82f6', // Azul
    '#f59e0b', // Amarillo
    '#ef4444', // Rojo
    '#8b5cf6', // Púrpura
    '#06b6d4'  // Cyan
  ];

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📦</div>
          <p>No hay datos de adopción de packs disponibles</p>
        </div>
      </div>
    );
  }

  // Preparar datos para gráficos
  const pieData = data.map(item => ({
    name: item.pack_name,
    value: item.installs,
    category: item.category
  }));

  const barData = data.map(item => ({
    pack: item.pack_name.replace(' & ', '\n& '),
    'Tasa Adopción': item.adoption_rate,
    'Tasa Éxito': item.success_rate,
    'Usuarios Activos': (item.active_users / item.installs) * 100
  }));

  return (
    <div className="w-full space-y-6">
      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Distribución de Installs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribución de Instalaciones</CardTitle>
            <CardDescription>Por categoría de pack de templates</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Instalaciones']}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart - Tasas de Adopción y Éxito */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tasas de Adopción y Éxito</CardTitle>
            <CardDescription>Comparación de métricas clave por pack</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="pack" 
                  stroke="#666"
                  fontSize={10}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  tickFormatter={formatPercent}
                />
                <Tooltip 
                  formatter={(value: number) => [formatPercent(value), '']}
                  labelStyle={{ color: '#333' }}
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="Tasa Adopción" 
                  fill="#10b981" 
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="Tasa Éxito" 
                  fill="#3b82f6" 
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas Detalladas por Pack</CardTitle>
          <CardDescription>Vista completa de adopción, éxito y valor generado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Pack</th>
                  <th className="text-center p-2 font-medium">Installs</th>
                  <th className="text-center p-2 font-medium">Usuarios Activos</th>
                  <th className="text-center p-2 font-medium">Tasa Éxito</th>
                  <th className="text-center p-2 font-medium">Outcomes/Usuario</th>
                  <th className="text-center p-2 font-medium">Horas Ahorradas</th>
                  <th className="text-center p-2 font-medium">Adopción</th>
                </tr>
              </thead>
              <tbody>
                {data.map((pack, index) => (
                  <tr key={pack.pack_name} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium">{pack.pack_name}</span>
                      </div>
                    </td>
                    <td className="text-center p-2">{pack.installs.toLocaleString()}</td>
                    <td className="text-center p-2">
                      <span className="font-medium">{pack.active_users.toLocaleString()}</span>
                      <span className="text-gray-500 text-xs block">
                        ({((pack.active_users / pack.installs) * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td className="text-center p-2">
                      <span className={`font-medium ${pack.success_rate > 90 ? 'text-green-600' : pack.success_rate > 85 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatPercent(pack.success_rate)}
                      </span>
                    </td>
                    <td className="text-center p-2 font-medium">
                      {pack.avg_outcomes_per_user.toFixed(1)}
                    </td>
                    <td className="text-center p-2">
                      <span className="font-medium text-blue-600">
                        {pack.total_hours_saved.toLocaleString()}h
                      </span>
                    </td>
                    <td className="text-center p-2">
                      <span className={`font-medium ${pack.adoption_rate > 75 ? 'text-green-600' : pack.adoption_rate > 65 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatPercent(pack.adoption_rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Insights y recomendaciones */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 Insights de Adopción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-green-700">✅ Packs Top Performers</h4>
              {data
                .filter(pack => pack.adoption_rate > 75 && pack.success_rate > 85)
                .slice(0, 3)
                .map(pack => (
                  <div key={pack.pack_name} className="text-sm p-2 bg-green-50 rounded">
                    <strong>{pack.pack_name}</strong>: {formatPercent(pack.adoption_rate)} adopción, 
                    {formatPercent(pack.success_rate)} éxito
                  </div>
                ))}
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-orange-700">⚠️ Oportunidades de Mejora</h4>
              {data
                .filter(pack => pack.adoption_rate < 75 || pack.success_rate < 85)
                .slice(0, 3)
                .map(pack => (
                  <div key={pack.pack_name} className="text-sm p-2 bg-orange-50 rounded">
                    <strong>{pack.pack_name}</strong>: 
                    {pack.adoption_rate < 75 && ` Baja adopción (${formatPercent(pack.adoption_rate)})`}
                    {pack.success_rate < 85 && ` Baja tasa éxito (${formatPercent(pack.success_rate)})`}
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">📊 Resumen Ejecutivo</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Total Instalaciones:</strong> {data.reduce((sum, pack) => sum + pack.installs, 0).toLocaleString()}</p>
              <p>• <strong>Usuarios Activos:</strong> {data.reduce((sum, pack) => sum + pack.active_users, 0).toLocaleString()}</p>
              <p>• <strong>Horas Ahorradas:</strong> {data.reduce((sum, pack) => sum + pack.total_hours_saved, 0).toLocaleString()}h</p>
              <p>• <strong>Pack Líder:</strong> {data.sort((a, b) => b.installs - a.installs)[0]?.pack_name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}