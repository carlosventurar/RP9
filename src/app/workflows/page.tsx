'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Search, 
  Plus, 
  Play, 
  Pause, 
  Settings, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react"
import { N8nWorkflow } from '@/lib/n8n'
import { useWorkflowTranslations } from '@/hooks/use-translations'

interface WorkflowWithStats extends N8nWorkflow {
  lastExecution?: string
  executionCount?: number
  successRate?: number
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowWithStats[]>([])
  const [filteredWorkflows, setFilteredWorkflows] = useState<WorkflowWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Use translations with error handling
  let t: any = {}
  try {
    t = useWorkflowTranslations()
  } catch (error) {
    // Fallback translations if hook fails
    t = {
      title: 'Workflows',
      subtitle: 'Manage and monitor your automation workflows',
      newWorkflow: 'New Workflow',
      searchWorkflows: 'Search workflows...',
      lastRun: 'Last Run',
      executions: 'Executions',
      run: 'Run',
      never: 'Never',
      all: 'All',
      active: 'Active',
      inactive: 'Inactive',
      success: 'Success',
      crossnetFilterActive: 'Crossnet Filter Active',
      noWorkflowsMatchFilters: 'No workflows match your filters',
      noWorkflowsFound: 'No workflows found',
      createFirstWorkflow: 'Create First Workflow'
    }
  }

  // Mock data for development
  const mockWorkflows: WorkflowWithStats[] = [
    {
      id: '1',
      name: 'Lead Generation Flow',
      active: true,
      nodes: [],
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:22:00Z',
      lastExecution: '2 min ago',
      executionCount: 1247,
      successRate: 98.5
    },
    {
      id: '2', 
      name: 'Email Campaign Automation',
      active: true,
      nodes: [],
      createdAt: '2024-01-10T09:15:00Z',
      updatedAt: '2024-01-22T16:45:00Z',
      lastExecution: '5 min ago',
      executionCount: 892,
      successRate: 99.1
    },
    {
      id: '3',
      name: 'Customer Onboarding',
      active: false,
      nodes: [],
      createdAt: '2024-01-05T11:20:00Z',
      updatedAt: '2024-01-18T13:30:00Z',
      lastExecution: '2 days ago',
      executionCount: 156,
      successRate: 95.2
    },
    {
      id: '4',
      name: 'Invoice Processing',
      active: true,
      nodes: [],
      createdAt: '2024-01-12T14:45:00Z',
      updatedAt: '2024-01-21T10:15:00Z',
      lastExecution: '1 hour ago',
      executionCount: 2341,
      successRate: 97.8
    },
  ]

  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/workflows')
        if (response.ok) {
          const data = await response.json()
          setWorkflows(data.data || [])
        } else {
          console.error('Failed to fetch workflows:', response.statusText)
          // Fallback to mock data if API fails
          setWorkflows(mockWorkflows)
        }
      } catch (error) {
        console.error('Failed to fetch workflows:', error)
        // Fallback to mock data if API fails
        setWorkflows(mockWorkflows)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkflows()
  }, [])

  useEffect(() => {
    let filtered = workflows

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(workflow =>
        workflow.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(workflow =>
        statusFilter === 'active' ? workflow.active : !workflow.active
      )
    }

    setFilteredWorkflows(filtered)
  }, [workflows, searchTerm, statusFilter])

  const handleToggleWorkflow = async (workflow: WorkflowWithStats) => {
    setActionLoading(workflow.id!)
    try {
      const endpoint = workflow.active ? 'deactivate' : 'activate'
      const response = await fetch(`/api/workflows/${workflow.id}/${endpoint}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        // Update local state
        setWorkflows(prev =>
          prev.map(w =>
            w.id === workflow.id ? { ...w, active: !w.active } : w
          )
        )
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRunWorkflow = async (workflowId: string) => {
    setActionLoading(workflowId)
    try {
      const response = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        // Show success message or update UI
        console.log('Workflow executed successfully')
      }
    } catch (error) {
      console.error('Failed to run workflow:', error)
    } finally {
      setActionLoading(null)
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              {t('subtitle')}
            </p>
            <Badge variant="secondary" className="text-xs">
              {t('crossnetFilterActive')}
            </Badge>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('newWorkflow')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('searchWorkflows')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="active">{t('active')}</SelectItem>
            <SelectItem value="inactive">{t('inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Workflows Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredWorkflows.map((workflow) => (
          <Card key={workflow.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg leading-tight">{workflow.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={workflow.active ? "default" : "secondary"}>
                      {workflow.active ? t('active') : t('inactive')}
                    </Badge>
                    {workflow.successRate && (
                      <Badge variant="outline" className="text-xs">
                        {workflow.successRate}% {t('success')}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleToggleWorkflow(workflow)}
                  disabled={actionLoading === workflow.id}
                >
                  {actionLoading === workflow.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : workflow.active ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">{t('lastRun')}</div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {workflow.lastExecution || t('never')}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">{t('executions')}</div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {workflow.executionCount || 0}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleRunWorkflow(workflow.id!)}
                  disabled={actionLoading === workflow.id}
                >
                  {actionLoading === workflow.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  {t('run')}
                </Button>
                <Button variant="ghost" size="sm">
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredWorkflows.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            {searchTerm || statusFilter !== 'all' ? 
              t('noWorkflowsMatchFilters') : 
              t('noWorkflowsFound')
            }
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('createFirstWorkflow')}
          </Button>
        </div>
      )}
    </div>
  )
}