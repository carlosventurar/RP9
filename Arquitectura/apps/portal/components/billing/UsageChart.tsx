'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
export function UsageChart({ data }:{ data: any[] }){
  const chart = data.map(d=>({ day:d.d, OK:d.ok, Errors:d.err }))
  return (
    <div className="p-4 border rounded-2xl">
      <div className="font-medium mb-2">Consumo diario</div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" /><YAxis /><Tooltip />
            <Bar dataKey="OK" />
            <Bar dataKey="Errors" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
