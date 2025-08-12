'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

interface UsageData {
  day: string
  executions_success: number
  executions_error: number
  total_executions: number
}

interface UsageChartProps {
  data: UsageData[]
  title?: string
}

export function UsageChart({ data, title = "Consumo diario" }: UsageChartProps) {
  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => d.total_executions))
  
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            No hay datos de uso disponibles
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Exitosas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Errores</span>
            </div>
          </div>

          {/* Custom Bar Chart */}
          <div className="space-y-2">
            {data.slice(-7).map((item, index) => { // Show last 7 days
              const successPercentage = maxValue > 0 ? (item.executions_success / maxValue) * 100 : 0
              const errorPercentage = maxValue > 0 ? (item.executions_error / maxValue) * 100 : 0
              
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {new Date(item.day).toLocaleDateString('es-ES', { 
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      {item.total_executions} ejecuciones
                    </span>
                  </div>
                  
                  <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                    {/* Success bar */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${successPercentage}%` }}
                    />
                    {/* Error bar */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-300"
                      style={{ 
                        left: `${successPercentage}%`,
                        width: `${errorPercentage}%` 
                      }}
                    />
                    
                    {/* Hover tooltip content */}
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white opacity-0 hover:opacity-100 transition-opacity">
                      {item.executions_success > 0 && (
                        <span>{item.executions_success} OK</span>
                      )}
                      {item.executions_success > 0 && item.executions_error > 0 && (
                        <span className="mx-1">•</span>
                      )}
                      {item.executions_error > 0 && (
                        <span>{item.executions_error} ERR</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.reduce((sum, item) => sum + item.executions_success, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Exitosas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {data.reduce((sum, item) => sum + item.executions_error, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Errores</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {data.reduce((sum, item) => sum + item.total_executions, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}