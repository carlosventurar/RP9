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
  Loader2,
  X
} from "lucide-react"
import { N8nWorkflow } from '@/lib/n8n'
// import { useWorkflowTranslations } from '@/hooks/use-translations'
import CreateWorkflowModal from '@/components/workflows/CreateWorkflowModal'

interface WorkflowWithStats extends N8nWorkflow {
  lastExecution?: string
  executionCount?: number
  successRate?: number
  tags?: string[]
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowWithStats[]>([])
  const [filteredWorkflows, setFilteredWorkflows] = useState<WorkflowWithStats[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Use fallback translations for debugging
  const t = {
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
      successRate: 98.5,
      tags: ['marketing', 'leads', 'crm']
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
      successRate: 99.1,
      tags: ['email', 'marketing', 'campaigns']
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
      successRate: 95.2,
      tags: ['onboarding', 'customers', 'welcome']
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
      successRate: 97.8,
      tags: ['finance', 'automation', 'accounting']
    },
  ]

  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoading(true)
      try {
        // Try direct n8n API first
        const response = await fetch('/api/workflows-direct')
        if (response.ok) {
          const data = await response.json()
          
          // Check if we got fallback data (API was unavailable)
          if (data.fallback) {
            console.warn('N8N API temporarily unavailable, using fallback data')
            setWorkflows(mockWorkflows)
            setAvailableTags(['finance', 'automation', 'email', 'marketing', 'crm', 'leads', 'campaigns', 'onboarding', 'customers', 'accounting', 'welcome'])
          } else {
            // Use real data from n8n
            setWorkflows(data.data || [])
            setAvailableTags(data.tags || [])
          }
        } else {
          console.error('Failed to fetch workflows from n8n:', response.statusText)
          // Fallback to mock data if API fails
          setWorkflows(mockWorkflows)
          setAvailableTags(['finance', 'automation', 'email', 'marketing', 'crm', 'leads', 'campaigns', 'onboarding', 'customers', 'accounting', 'welcome'])
        }
      } catch (error) {
        console.error('Failed to fetch workflows:', error)
        // Fallback to mock data if API fails
        setWorkflows(mockWorkflows)
        setAvailableTags(['finance', 'automation', 'email', 'marketing', 'crm', 'leads', 'campaigns', 'onboarding', 'customers', 'accounting', 'welcome'])
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
      filtered = filtered.filter(workflow => {
        const workflowName = typeof workflow.name === 'string' ? workflow.name : (workflow.name ? String(workflow.name) : '')
        return workflowName.toLowerCase().includes(searchTerm.toLowerCase())
      })
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(workflow =>
        statusFilter === 'active' ? workflow.active : !workflow.active
      )
    }

    // Filter by tag
    if (tagFilter !== 'all') {
      filtered = filtered.filter(workflow =>
        workflow.tags && workflow.tags.includes(tagFilter)
      )
    }

    setFilteredWorkflows(filtered)
  }, [workflows, searchTerm, statusFilter, tagFilter])

  const handleToggleWorkflow = async (workflow: WorkflowWithStats) => {
    setActionLoading(workflow.id!)
    try {
      const endpoint = workflow.active ? 'deactivate' : 'activate'
      const response = await fetch(`/api/workflows-direct/${workflow.id}/${endpoint}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        // Update local state
        setWorkflows(prev =>
          prev.map(w =>
            w.id === workflow.id ? { ...w, active: !w.active } : w
          )
        )
      } else {
        console.error('Failed to toggle workflow:', response.statusText)
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
      const response = await fetch(`/api/workflows-direct/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        // Show success message or update UI
        console.log('Workflow executed successfully')
        
        // Optionally refresh workflows to get updated execution count
        // fetchWorkflows()
      } else {
        console.error('Failed to run workflow:', response.statusText)
      }
    } catch (error) {
      console.error('Failed to run workflow:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const clearAllFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setTagFilter('all')
  }

  const handleCreateSuccess = () => {
    // Refrescar la lista de workflows
    const fetchWorkflows = async () => {
      setLoading(true)
      try {
        // Try direct n8n API first
        const response = await fetch('/api/workflows-direct')
        if (response.ok) {
          const data = await response.json()
          
          // Check if we got fallback data (API was unavailable)
          if (data.fallback) {
            console.warn('N8N API temporarily unavailable, using fallback data')
            setWorkflows(mockWorkflows)
            setAvailableTags(['finance', 'automation', 'email', 'marketing', 'crm', 'leads', 'campaigns', 'onboarding', 'customers', 'accounting', 'welcome'])
          } else {
            // Use real data from n8n
            setWorkflows(data.data || [])
            setAvailableTags(data.tags || [])
          }
        } else {
          console.error('Failed to fetch workflows from n8n:', response.statusText)
          // Fallback to mock data if API fails
          setWorkflows(mockWorkflows)
          setAvailableTags(['finance', 'automation', 'email', 'marketing', 'crm', 'leads', 'campaigns', 'onboarding', 'customers', 'accounting', 'welcome'])
        }
      } catch (error) {
        console.error('Failed to fetch workflows:', error)
        // Fallback to mock data if API fails
        setWorkflows(mockWorkflows)
        setAvailableTags(['finance', 'automation', 'email', 'marketing', 'crm', 'leads', 'campaigns', 'onboarding', 'customers', 'accounting', 'welcome'])
      } finally {
        setLoading(false)
      }
    }

    fetchWorkflows()
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
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              {t.subtitle}
            </p>
            <Badge variant="secondary" className="text-xs">
              {t.crossnetFilterActive}
            </Badge>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t.newWorkflow}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t.searchWorkflows}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filtrar por tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tags</SelectItem>
            {availableTags.map(tag => (
              <SelectItem key={tag} value={tag}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  {tag}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchTerm || statusFilter !== 'all' || tagFilter !== 'all') && (
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              {filteredWorkflows.length} de {workflows.length} workflows
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Workflows Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredWorkflows.map((workflow) => (
          <Card key={workflow.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg leading-tight">
                    {typeof workflow.name === 'string' ? workflow.name : (workflow.name ? String(workflow.name) : 'Untitled Workflow')}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={workflow.active ? "default" : "secondary"}>
                      {workflow.active ? t.active : t.inactive}
                    </Badge>
                    {workflow.successRate && (
                      <Badge variant="outline" className="text-xs">
                        {typeof workflow.successRate === 'number' ? workflow.successRate : 0}% {t.success}
                      </Badge>
                    )}
                  </div>
                  {workflow.tags && workflow.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {workflow.tags.slice(0, 3).map(tag => (
                        <Badge key={String(tag)} variant="secondary" className="text-xs px-2 py-0">
                          {String(tag)}
                        </Badge>
                      ))}
                      {workflow.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs px-2 py-0">
                          +{workflow.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
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
                  <div className="text-muted-foreground">{t.lastRun}</div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {typeof workflow.lastExecution === 'string' ? workflow.lastExecution : t.never}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">{t.executions}</div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {typeof workflow.executionCount === 'number' ? workflow.executionCount : 0}
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
                  {t.run}
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
              t.noWorkflowsMatchFilters : 
              t.noWorkflowsFound
            }
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t.createFirstWorkflow}
          </Button>
        </div>
      )}

      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
        availableTags={availableTags}
      />
    </div>
  )
}