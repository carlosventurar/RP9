import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { getTenantData } from '@/lib/auth/supabase-auth'

export interface N8nConfig {
  baseUrl: string
  apiKey: string
}

export interface N8nWorkflow {
  id?: string
  name: string
  active?: boolean
  nodes: any[]
  connections?: any
  settings?: any
  createdAt?: string
  updatedAt?: string
  tags?: string[]
}

export interface N8nExecution {
  id: string
  workflowId: string
  status: 'success' | 'error' | 'running' | 'waiting'
  startedAt: string
  stoppedAt?: string
  mode: string
  data?: any
}

export class N8nClient {
  private client: AxiosInstance

  constructor(config: N8nConfig) {
    this.client = axios.create({
      baseURL: `${config.baseUrl.replace(/\/$/, '')}/api/v1`,
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    })

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`n8n API Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        console.error('n8n API Request Error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        console.log(`n8n API Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        console.error('n8n API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        })
        return Promise.reject(error)
      }
    )
  }

  async getWorkflows(params?: { active?: boolean }): Promise<N8nWorkflow[]> {
    try {
      const response: AxiosResponse<{ data: N8nWorkflow[] }> = await this.client.get('/workflows', { params })
      return response.data.data || []
    } catch (error) {
      console.error('Error fetching workflows:', error)
      throw new Error('Failed to fetch workflows')
    }
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<N8nWorkflow> = await this.client.get(`/workflows/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching workflow ${id}:`, error)
      throw new Error(`Failed to fetch workflow ${id}`)
    }
  }

  async createWorkflow(workflow: Omit<N8nWorkflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<N8nWorkflow> = await this.client.post('/workflows', workflow)
      return response.data
    } catch (error) {
      console.error('Error creating workflow:', error)
      throw new Error('Failed to create workflow')
    }
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<N8nWorkflow> = await this.client.patch(`/workflows/${id}`, workflow)
      return response.data
    } catch (error) {
      console.error(`Error updating workflow ${id}:`, error)
      throw new Error(`Failed to update workflow ${id}`)
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      await this.client.delete(`/workflows/${id}`)
    } catch (error) {
      console.error(`Error deleting workflow ${id}:`, error)
      throw new Error(`Failed to delete workflow ${id}`)
    }
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<N8nWorkflow> = await this.client.patch(`/workflows/${id}`, { active: true })
      return response.data
    } catch (error) {
      console.error(`Error activating workflow ${id}:`, error)
      throw new Error(`Failed to activate workflow ${id}`)
    }
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<N8nWorkflow> = await this.client.patch(`/workflows/${id}`, { active: false })
      return response.data
    } catch (error) {
      console.error(`Error deactivating workflow ${id}:`, error)
      throw new Error(`Failed to deactivate workflow ${id}`)
    }
  }

  async getExecutions(params?: {
    status?: string
    workflowId?: string
    limit?: number
    lastId?: string
  }): Promise<N8nExecution[]> {
    try {
      const response: AxiosResponse<{ data: N8nExecution[] }> = await this.client.get('/executions', { params })
      return response.data.data || []
    } catch (error) {
      console.error('Error fetching executions:', error)
      throw new Error('Failed to fetch executions')
    }
  }

  async runWorkflow(id: string, data?: any): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.client.post(`/workflows/${id}/run`, data || {})
      return response.data
    } catch (error) {
      console.error(`Error running workflow ${id}:`, error)
      throw new Error(`Failed to run workflow ${id}`)
    }
  }
}

export interface TenantConfig {
  baseUrl: string
  apiKey: string
  allowedTags?: string[]
  nameFilter?: string
  filterMode?: 'tags' | 'name' | 'both'
}

// Configuración de tenants con filtros específicos
const TENANT_CONFIG: Record<string, TenantConfig> = {
  'demo-tenant': {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY || 'demo-api-key',
    allowedTags: ['Crossnet'],
    nameFilter: 'Crossnet',
    filterMode: 'name' // Usar filtro por nombre por ahora
  }
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  try {
    const tenantData = await getTenantData(tenantId)
    
    if (tenantData && tenantData.n8n_base_url && tenantData.n8n_api_key) {
      const settings = tenantData.settings || {}
      
      return {
        baseUrl: tenantData.n8n_base_url,
        apiKey: tenantData.n8n_api_key,
        allowedTags: settings.allowedTags || ['Crossnet'],
        nameFilter: settings.nameFilter || 'Crossnet',
        filterMode: settings.filterMode || 'name'
      }
    }
    
    // Fallback to default configuration
    return TENANT_CONFIG['demo-tenant'] || {
      baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
      apiKey: process.env.N8N_API_KEY || 'demo-api-key',
      allowedTags: ['Crossnet'],
      nameFilter: 'Crossnet',
      filterMode: 'name'
    }
  } catch (error) {
    console.error('Failed to get tenant config:', error)
    return {
      baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
      apiKey: process.env.N8N_API_KEY || 'demo-api-key',
      allowedTags: ['Crossnet'],
      nameFilter: 'Crossnet',
      filterMode: 'name'
    }
  }
}

export async function filterWorkflowsByTenant(workflows: N8nWorkflow[], tenantId: string): Promise<N8nWorkflow[]> {
  const config = await getTenantConfig(tenantId)
  
  return workflows.filter(workflow => {
    // Filtro por nombre (más confiable por ahora)
    if (config.filterMode === 'name' || config.filterMode === 'both') {
      if (config.nameFilter && !workflow.name.toLowerCase().includes(config.nameFilter.toLowerCase())) {
        return false
      }
    }
    
    // Filtro por tags (para futuro uso)
    if (config.filterMode === 'tags' || config.filterMode === 'both') {
      if (config.allowedTags && workflow.tags) {
        const hasAllowedTag = workflow.tags.some(tag => 
          config.allowedTags!.some(allowedTag => 
            tag.toLowerCase().includes(allowedTag.toLowerCase())
          )
        )
        if (!hasAllowedTag) {
          return false
        }
      }
    }
    
    return true
  })
}

export async function createN8nClient(tenantId?: string): Promise<N8nClient> {
  const config = await getTenantConfig(tenantId || 'demo-tenant')
  
  return new N8nClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  })
}