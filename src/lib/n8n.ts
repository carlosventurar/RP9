import axios, { AxiosInstance, AxiosResponse } from 'axios'

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

export function createN8nClient(tenantId?: string): N8nClient {
  const baseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678'
  const apiKey = process.env.N8N_API_KEY || 'demo-api-key'

  // In a real implementation, you would resolve tenant-specific configs here
  // For now, we use the default configuration
  
  return new N8nClient({
    baseUrl,
    apiKey,
  })
}