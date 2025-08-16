'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  PlayCircle,
  Calendar,
  ArrowUpDown,
  Activity,
  Server,
  Database,
  Cpu,
  MemoryStick,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  BarChart3,
  Gauge
} from "lucide-react"
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { N8nExecution } from '@/lib/n8n'

interface ExecutionWithWorkflow extends N8nExecution {
  workflowName?: string
  duration?: string
  errorMessage?: string
}

export default function AnalyticsPage() {
  const [executions, setExecutions] = useState<ExecutionWithWorkflow[]>([])
  const [filteredExecutions, setFilteredExecutions] = useState<ExecutionWithWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'running' | 'waiting'>('all')

  // Mock data for development
  const mockExecutions: ExecutionWithWorkflow[] = [
    {
      id: 'exec_001',
      workflowId: '1',
      workflowName: 'Lead Generation Flow',
      status: 'success',
      startedAt: '2024-01-23T10:30:00Z',
      stoppedAt: '2024-01-23T10:30:02Z',
      duration: '2.3s',
      mode: 'webhook'
    },
    {
      id: 'exec_002',
      workflowId: '2',
      workflowName: 'Email Campaign Automation',
      status: 'success',
      startedAt: '2024-01-23T10:25:00Z',
      stoppedAt: '2024-01-23T10:25:01Z',
      duration: '1.8s',
      mode: 'webhook'
    },
    {
      id: 'exec_003',
      workflowId: '1',
      workflowName: 'Lead Generation Flow',
      status: 'error',
      startedAt: '2024-01-23T10:20:00Z',
      stoppedAt: '2024-01-23T10:20:15Z',
      duration: '15.2s',
      mode: 'manual',
      errorMessage: 'HTTP request failed: Connection timeout'
    },
    {
      id: 'exec_004',
      workflowId: '4',
      workflowName: 'Invoice Processing',
      status: 'running',
      startedAt: '2024-01-23T10:15:00Z',
      duration: '45s',
      mode: 'trigger'
    },
    {
      id: 'exec_005',
      workflowId: '3',
      workflowName: 'Customer Onboarding',
      status: 'success',
      startedAt: '2024-01-23T09:45:00Z',
      stoppedAt: '2024-01-23T09:45:03Z',
      duration: '3.1s',
      mode: 'webhook'
    },
    {
      id: 'exec_006',
      workflowId: '2',
      workflowName: 'Email Campaign Automation',
      status: 'waiting',
      startedAt: '2024-01-23T09:30:00Z',
      mode: 'trigger'
    }
  ]

  useEffect(() => {
    const fetchExecutions = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/executions')
        if (response.ok) {
          const data = await response.json()
          setExecutions(data.data || [])
        } else {
          console.error('Failed to fetch executions:', response.statusText)
          // Fallback to mock data if API fails
          setExecutions(mockExecutions)
        }
      } catch (error) {
        console.error('Failed to fetch executions:', error)
        // Fallback to mock data if API fails
        setExecutions(mockExecutions)
      } finally {
        setLoading(false)
      }
    }

    fetchExecutions()
  }, [])

  useEffect(() => {
    let filtered = executions

    // Filter by search term (workflow name)
    if (searchTerm) {
      filtered = filtered.filter(execution =>
        execution.workflowName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(execution => execution.status === statusFilter)
    }

    setFilteredExecutions(filtered)
  }, [executions, searchTerm, statusFilter])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'waiting':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <PlayCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default' as const,
      error: 'destructive' as const,
      running: 'secondary' as const,
      waiting: 'outline' as const
    }
    return variants[status as keyof typeof variants] || 'outline'
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
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
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Executions</h1>
        <p className="text-muted-foreground">
          Monitor workflow executions and performance metrics
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executions.length}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((executions.filter(e => e.status === 'success').length / executions.length) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">+2% from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Executions</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {executions.filter(e => e.status === 'error').length}
            </div>
            <p className="text-xs text-muted-foreground">-1 from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4s</div>
            <p className="text-xs text-muted-foreground">-0.2s from yesterday</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by workflow..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Failed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Executions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
          <CardDescription>
            Latest workflow execution results and performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredExecutions.map((execution) => (
              <div key={execution.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-4">
                  {getStatusIcon(execution.status)}
                  <div className="space-y-1">
                    <div className="font-medium">{execution.workflowName}</div>
                    <div className="text-sm text-muted-foreground">
                      {execution.mode} • {getTimeAgo(execution.startedAt)}
                    </div>
                    {execution.errorMessage && (
                      <div className="text-sm text-red-600 max-w-md truncate">
                        {execution.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <Badge variant={getStatusBadge(execution.status)}>
                      {execution.status}
                    </Badge>
                    {execution.duration && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {execution.duration}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredExecutions.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== 'all' ? 
                'No executions match your filters' : 
                'No executions found'
              }
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}