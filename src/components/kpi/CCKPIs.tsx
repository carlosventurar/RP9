'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Phone, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Users,
  Star,
  Loader2,
  RefreshCw
} from "lucide-react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'

interface ContactCenterKPIs {
  period: string
  totalCalls: number
  answeredCalls: number
  abandonedCalls: number
  transferredCalls: number
  avgHandleTime: number
  p95HandleTime: number
  avgCSAT: number | null
  csatResponseRate: number
  errorRate: number
  topAgents: Array<{
    agentId: string
    agentName: string
    callCount: number
    avgHandleTime: number
    avgCSAT: number | null
  }>
  hourlyDistribution: Array<{
    hour: number
    callCount: number
    avgHandleTime: number
  }>
  statusBreakdown: {
    completed: number
    abandoned: number
    transferred: number
    error: number
  }
}

const COLORS = {
  completed: '#10b981',
  abandoned: '#f59e0b', 
  transferred: '#3b82f6',
  error: '#ef4444'
}

export default function CCKPIs() {
  const [kpis, setKPIs] = useState<ContactCenterKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')
  const [refreshing, setRefreshing] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadKPIs()
  }, [period])

  async function loadKPIs() {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('No authentication session')
        return
      }

      const response = await fetch(`/.netlify/functions/kpi-cc?period=${period}&hourly=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      setKPIs(result.data)
      
    } catch (error) {
      console.error('Error loading CC KPIs:', error)
      setError(error instanceof Error ? error.message : 'Failed to load KPIs')
      
      // Set mock data for development
      setKPIs({
        period: '7d',
        totalCalls: 247,
        answeredCalls: 198,
        abandonedCalls: 31,
        transferredCalls: 15,
        avgHandleTime: 342,
        p95HandleTime: 875,
        avgCSAT: 4.2,
        csatResponseRate: 68.5,
        errorRate: 1.2,
        topAgents: [
          { agentId: 'agent_001', agentName: 'María García', callCount: 45, avgHandleTime: 320, avgCSAT: 4.8 },
          { agentId: 'agent_002', agentName: 'Carlos López', callCount: 38, avgHandleTime: 298, avgCSAT: 4.3 },
          { agentId: 'agent_003', agentName: 'Ana Rodríguez', callCount: 35, avgHandleTime: 365, avgCSAT: 4.1 }
        ],
        hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          callCount: Math.max(0, Math.floor(Math.random() * 20) - (hour < 8 || hour > 20 ? 15 : 0)),
          avgHandleTime: 280 + Math.random() * 200
        })),
        statusBreakdown: {
          completed: 198,
          abandoned: 31,
          transferred: 15,
          error: 3
        }
      })
      
    } finally {
      setLoading(false)
    }
  }

  async function refreshData() {
    setRefreshing(true)
    await loadKPIs()
    setRefreshing(false)
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  function formatHour(hour: number): string {
    return hour === 0 ? '12 AM' : 
           hour < 12 ? `${hour} AM` :
           hour === 12 ? '12 PM' :
           `${hour - 12} PM`
  }

  if (loading && !kpis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Center KPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!kpis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Center KPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {error || 'No contact center data available'}
            </p>
            <Button onClick={refreshData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const pieData = [
    { name: 'Completed', value: kpis.statusBreakdown.completed, color: COLORS.completed },
    { name: 'Abandoned', value: kpis.statusBreakdown.abandoned, color: COLORS.abandoned },
    { name: 'Transferred', value: kpis.statusBreakdown.transferred, color: COLORS.transferred },
    { name: 'Error', value: kpis.statusBreakdown.error, color: COLORS.error }
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Contact Center KPIs
          </h2>
          <p className="text-muted-foreground">
            Performance metrics for your contact center operations
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{kpis.totalCalls.toLocaleString()}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Handle Time</p>
                <p className="text-2xl font-bold">{formatTime(kpis.avgHandleTime)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CSAT Score</p>
                <p className="text-2xl font-bold">
                  {kpis.avgCSAT ? `${kpis.avgCSAT.toFixed(1)}/5` : 'N/A'}
                </p>
              </div>
              <Star className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Answer Rate</p>
                <p className="text-2xl font-bold">
                  {kpis.totalCalls > 0 ? `${((kpis.answeredCalls / kpis.totalCalls) * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown and Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Call Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">P95 Handle Time</span>
              <span className="font-bold">{formatTime(kpis.p95HandleTime)}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">CSAT Response Rate</span>
              <span className="font-bold">{kpis.csatResponseRate.toFixed(1)}%</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">Error Rate</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{kpis.errorRate.toFixed(1)}%</span>
                {kpis.errorRate > 5 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    High
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">Abandonment Rate</span>
              <span className="font-bold">
                {kpis.totalCalls > 0 ? `${((kpis.abandonedCalls / kpis.totalCalls) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Distribution */}
      {kpis.hourlyDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hourly Call Distribution</CardTitle>
            <CardDescription>Call volume and average handle time by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={formatHour}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(hour) => `Hour: ${formatHour(Number(hour))}`}
                    formatter={(value, name) => [
                      name === 'callCount' ? value : `${Math.round(Number(value))}s`,
                      name === 'callCount' ? 'Calls' : 'Avg Handle Time'
                    ]}
                  />
                  <Bar dataKey="callCount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Agents */}
      {kpis.topAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Performing Agents
            </CardTitle>
            <CardDescription>Ranked by call volume and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpis.topAgents.map((agent, index) => (
                <div 
                  key={agent.agentId} 
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                      <span className="text-sm font-bold text-primary">
                        #{index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{agent.agentName}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.callCount} calls
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatTime(agent.avgHandleTime)} AHT
                    </p>
                    {agent.avgCSAT && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm">{agent.avgCSAT.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}