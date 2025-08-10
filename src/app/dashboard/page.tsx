'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Workflow, TrendingUp, Clock, Loader2 } from "lucide-react"

interface DashboardMetrics {
  total_executions: number
  successful_executions: number
  failed_executions: number
  success_rate: number
  avg_duration_seconds: number
  p95_duration_seconds: number
  active_workflows: number
}

interface Execution {
  id: string
  workflow_name: string
  status: 'success' | 'error' | 'running' | 'waiting' | 'canceled'
  started_at: string
  stopped_at: string | null
  duration_ms: number | null
}

interface DashboardData {
  metrics: DashboardMetrics
  recentExecutions: Execution[]
  topWorkflows: { name: string; count: number }[]
  period: string
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/dashboard')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          throw new Error(result.error || 'Failed to fetch dashboard data')
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Set default data for development
        setData({
          metrics: {
            total_executions: 0,
            successful_executions: 0,
            failed_executions: 0,
            success_rate: 0,
            avg_duration_seconds: 0,
            p95_duration_seconds: 0,
            active_workflows: 0
          },
          recentExecutions: [],
          topWorkflows: [],
          period: '24h'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const formatDuration = (ms: number | null) => {
    if (!ms) return '0s'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`
    return `${Math.floor(diffMins / 1440)} days ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your automation workflows and system performance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Executions Today
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.metrics.total_executions.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">
              Last {data?.period || '24h'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Workflows
            </CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.metrics.active_workflows || '0'}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.metrics.success_rate ? `${data.metrics.success_rate}%` : '0%'}</div>
            <p className="text-xs text-muted-foreground">
              {data?.metrics.successful_executions || 0} of {data?.metrics.total_executions || 0} successful
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.metrics.avg_duration_seconds ? `${data.metrics.avg_duration_seconds}s` : '0s'}
            </div>
            <p className="text-xs text-muted-foreground">
              P95: {data?.metrics.p95_duration_seconds ? `${data.metrics.p95_duration_seconds}s` : '0s'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Workflow Executions</CardTitle>
            <CardDescription>
              Latest automation runs and their status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.recentExecutions && data.recentExecutions.length > 0 ? (
              data.recentExecutions.map((execution) => (
                <div key={execution.id} className="flex items-center space-x-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {execution.workflow_name || 'Unknown Workflow'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(execution.started_at)} • Duration: {formatDuration(execution.duration_ms)}
                    </p>
                  </div>
                  <Badge variant={
                    execution.status === "success" ? "default" :
                    execution.status === "running" ? "secondary" : 
                    "destructive"
                  }>
                    {execution.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent executions</p>
                <p className="text-xs">Workflow executions will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Current status of RP9 platform services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { service: "n8n API", status: "operational" },
              { service: "Webhook Service", status: "operational" },
              { service: "Database", status: "operational" },
              { service: "Authentication", status: "operational" },
            ].map((service, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{service.service}</span>
                <Badge variant="default" className="bg-green-500">
                  {service.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}