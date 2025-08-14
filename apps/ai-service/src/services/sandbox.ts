import { config } from '@/utils/config'
import { logger, logError } from '@/utils/logger'
import { ContentValidator } from '@/utils/validators'
import type { GeneratedWorkflow } from '@/types'

interface SandboxResult {
  success: boolean
  executionId?: string
  duration: number
  errors: string[]
  warnings: string[]
  output?: any
  nodeResults?: Record<string, any>
}

interface SandboxWorkflow {
  id: string
  tenantId: string
  originalWorkflow: any
  sandboxWorkflow: any
  createdAt: Date
  expiresAt: Date
  status: 'created' | 'running' | 'completed' | 'failed' | 'expired'
}

export class SandboxService {
  private sandboxWorkflows: Map<string, SandboxWorkflow> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Cleanup expired sandboxes every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSandboxes()
    }, 5 * 60 * 1000)

    logger.info('Sandbox service initialized')
  }

  /**
   * Create a sandbox copy of a workflow for safe testing
   */
  async createSandbox(
    tenantId: string,
    workflow: GeneratedWorkflow,
    options: {
      mockData?: Record<string, any>
      maxDuration?: number
      disableExternalCalls?: boolean
    } = {}
  ): Promise<{ sandboxId: string; sandboxWorkflow: any }> {
    try {
      if (!config.SANDBOX_ENABLED) {
        throw new Error('Sandbox mode is disabled')
      }

      // Validate workflow first
      const validation = ContentValidator.validateWorkflowJSON(workflow)
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`)
      }

      const sandboxId = this.generateSandboxId()
      const expiresAt = new Date(Date.now() + (config.N8N_SANDBOX_TTL_MINUTES * 60 * 1000))

      // Create sanitized sandbox version
      const sandboxWorkflow = this.sanitizeWorkflowForSandbox(workflow, options)

      // Store sandbox workflow
      this.sandboxWorkflows.set(sandboxId, {
        id: sandboxId,
        tenantId,
        originalWorkflow: workflow,
        sandboxWorkflow,
        createdAt: new Date(),
        expiresAt,
        status: 'created'
      })

      // Create workflow in n8n
      const n8nWorkflowId = await this.createWorkflowInN8n(sandboxWorkflow, sandboxId)
      
      logger.info({
        sandboxId,
        tenantId,
        n8nWorkflowId,
        expiresAt
      }, 'Sandbox workflow created')

      return {
        sandboxId,
        sandboxWorkflow: {
          ...sandboxWorkflow,
          id: n8nWorkflowId
        }
      }

    } catch (error: any) {
      logError(error, { tenantId, workflow: workflow.name })
      throw new Error(`Failed to create sandbox: ${error.message}`)
    }
  }

  /**
   * Execute workflow in sandbox environment
   */
  async runSandboxTest(
    sandboxId: string,
    inputData?: any
  ): Promise<SandboxResult> {
    const startTime = Date.now()

    try {
      const sandbox = this.sandboxWorkflows.get(sandboxId)
      if (!sandbox) {
        throw new Error('Sandbox not found')
      }

      if (sandbox.status === 'expired') {
        throw new Error('Sandbox has expired')
      }

      if (Date.now() > sandbox.expiresAt.getTime()) {
        sandbox.status = 'expired'
        throw new Error('Sandbox has expired')
      }

      // Update status
      sandbox.status = 'running'

      // Execute in n8n with timeout
      const executionResult = await this.executeInN8n(sandbox.sandboxWorkflow, inputData)

      const duration = Date.now() - startTime
      sandbox.status = 'completed'

      const result: SandboxResult = {
        success: executionResult.success,
        executionId: executionResult.executionId,
        duration,
        errors: executionResult.errors || [],
        warnings: executionResult.warnings || [],
        output: executionResult.output,
        nodeResults: executionResult.nodeResults
      }

      logger.info({
        sandboxId,
        duration,
        success: result.success,
        errors: result.errors.length
      }, 'Sandbox execution completed')

      return result

    } catch (error: any) {
      const duration = Date.now() - startTime
      logError(error, { sandboxId })

      const sandbox = this.sandboxWorkflows.get(sandboxId)
      if (sandbox) {
        sandbox.status = 'failed'
      }

      return {
        success: false,
        duration,
        errors: [error.message],
        warnings: []
      }
    }
  }

  /**
   * Get sandbox status and results
   */
  getSandboxStatus(sandboxId: string): {
    exists: boolean
    status?: string
    expiresAt?: Date
    duration?: number
  } {
    const sandbox = this.sandboxWorkflows.get(sandboxId)
    
    if (!sandbox) {
      return { exists: false }
    }

    const isExpired = Date.now() > sandbox.expiresAt.getTime()
    if (isExpired && sandbox.status !== 'expired') {
      sandbox.status = 'expired'
    }

    return {
      exists: true,
      status: sandbox.status,
      expiresAt: sandbox.expiresAt,
      duration: sandbox.status === 'completed' 
        ? Date.now() - sandbox.createdAt.getTime() 
        : undefined
    }
  }

  /**
   * Clean up sandbox (delete from n8n and local storage)
   */
  async cleanupSandbox(sandboxId: string): Promise<boolean> {
    try {
      const sandbox = this.sandboxWorkflows.get(sandboxId)
      if (!sandbox) {
        return false
      }

      // Delete from n8n if it exists
      try {
        await this.deleteWorkflowFromN8n(sandbox.sandboxWorkflow.id)
      } catch (error) {
        // Log but don't fail - workflow might not exist in n8n
        logger.warn({ sandboxId, error: error.message }, 'Failed to delete sandbox workflow from n8n')
      }

      // Remove from local storage
      this.sandboxWorkflows.delete(sandboxId)

      logger.info({ sandboxId }, 'Sandbox cleaned up')
      return true

    } catch (error: any) {
      logError(error, { sandboxId })
      return false
    }
  }

  /**
   * Sanitize workflow for sandbox execution
   */
  private sanitizeWorkflowForSandbox(
    workflow: GeneratedWorkflow,
    options: {
      mockData?: Record<string, any>
      maxDuration?: number
      disableExternalCalls?: boolean
    }
  ): any {
    const sanitized = {
      name: `[SANDBOX] ${workflow.name}`,
      nodes: workflow.nodes.map(node => this.sanitizeNode(node, options)),
      connections: workflow.connections,
      active: false, // Never activate sandbox workflows
      tags: ['sandbox', 'ai-generated', 'test']
    }

    return sanitized
  }

  /**
   * Sanitize individual node for sandbox
   */
  private sanitizeNode(node: any, options: any): any {
    const sanitized = { ...node }

    // Add sandbox prefix to node names
    sanitized.name = `[SANDBOX] ${node.name}`

    // Handle different node types
    switch (node.type) {
      case 'n8n-nodes-base.httpRequest':
        // Replace external URLs with mock endpoints in sandbox
        if (options.disableExternalCalls !== false) {
          sanitized.parameters = {
            ...node.parameters,
            url: 'https://httpbin.org/post', // Safe test endpoint
            method: 'POST'
          }
        }
        break

      case 'n8n-nodes-base.emailSend':
        // Disable actual email sending in sandbox
        sanitized.disabled = true
        break

      case 'n8n-nodes-base.webhook':
        // Generate unique webhook path for sandbox
        const originalPath = node.parameters?.path || '/webhook'
        sanitized.parameters = {
          ...node.parameters,
          path: `/sandbox${originalPath}-${Math.random().toString(36).substr(2, 6)}`
        }
        break

      case 'n8n-nodes-base.slack':
      case 'n8n-nodes-base.whatsapp':
        // Disable external communication nodes
        sanitized.disabled = true
        break
    }

    // Inject mock data if provided
    if (options.mockData && node.type === 'n8n-nodes-base.manualTrigger') {
      sanitized.parameters = {
        ...node.parameters,
        mockData: options.mockData
      }
    }

    return sanitized
  }

  /**
   * Create workflow in n8n
   */
  private async createWorkflowInN8n(workflow: any, sandboxId: string): Promise<string> {
    try {
      const response = await fetch(`${config.N8N_BASE_URL}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': config.N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...workflow,
          tags: [...(workflow.tags || []), `sandbox:${sandboxId}`]
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`n8n API error (${response.status}): ${error.message || response.statusText}`)
      }

      const data = await response.json()
      return data.id

    } catch (error: any) {
      throw new Error(`Failed to create workflow in n8n: ${error.message}`)
    }
  }

  /**
   * Execute workflow in n8n
   */
  private async executeInN8n(workflow: any, inputData?: any): Promise<{
    success: boolean
    executionId?: string
    errors?: string[]
    warnings?: string[]
    output?: any
    nodeResults?: Record<string, any>
  }> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.SANDBOX_MAX_DURATION_MS)

      const response = await fetch(`${config.N8N_BASE_URL}/api/v1/workflows/${workflow.id}/execute`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': config.N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: inputData || { test: true }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`Execution failed (${response.status}): ${error.message || response.statusText}`)
      }

      const data = await response.json()

      // Parse execution results
      const result = {
        success: data.finished === true,
        executionId: data.id,
        errors: this.extractErrors(data),
        warnings: this.extractWarnings(data),
        output: data.data?.resultData?.lastNodeExecuted || null,
        nodeResults: this.extractNodeResults(data)
      }

      return result

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Sandbox execution timed out')
      }
      throw error
    }
  }

  /**
   * Delete workflow from n8n
   */
  private async deleteWorkflowFromN8n(workflowId: string): Promise<void> {
    try {
      const response = await fetch(`${config.N8N_BASE_URL}/api/v1/workflows/${workflowId}`, {
        method: 'DELETE',
        headers: {
          'X-N8N-API-KEY': config.N8N_API_KEY
        }
      })

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete workflow: ${response.statusText}`)
      }

    } catch (error: any) {
      throw new Error(`Failed to delete workflow from n8n: ${error.message}`)
    }
  }

  /**
   * Extract errors from execution data
   */
  private extractErrors(executionData: any): string[] {
    const errors: string[] = []

    if (executionData.data?.resultData?.error) {
      errors.push(executionData.data.resultData.error.message || 'Unknown execution error')
    }

    if (executionData.data?.executionData) {
      for (const nodeData of Object.values(executionData.data.executionData) as any[]) {
        if (nodeData && nodeData.error) {
          errors.push(nodeData.error.message || 'Node execution error')
        }
      }
    }

    return errors
  }

  /**
   * Extract warnings from execution data
   */
  private extractWarnings(executionData: any): string[] {
    const warnings: string[] = []

    // Check for partial execution
    if (executionData.finished === false && !executionData.data?.resultData?.error) {
      warnings.push('Workflow execution was incomplete')
    }

    // Check for disabled nodes
    if (executionData.data?.executionData) {
      const disabledNodes = Object.values(executionData.data.executionData)
        .filter((nodeData: any) => nodeData?.disabled === true)
      
      if (disabledNodes.length > 0) {
        warnings.push(`${disabledNodes.length} nodes were disabled during execution`)
      }
    }

    return warnings
  }

  /**
   * Extract node results from execution data
   */
  private extractNodeResults(executionData: any): Record<string, any> {
    const nodeResults: Record<string, any> = {}

    if (executionData.data?.executionData) {
      for (const [nodeId, nodeData] of Object.entries(executionData.data.executionData) as any) {
        nodeResults[nodeId] = {
          success: !nodeData.error,
          output: nodeData.data || null,
          error: nodeData.error?.message || null
        }
      }
    }

    return nodeResults
  }

  /**
   * Clean up expired sandboxes
   */
  private cleanupExpiredSandboxes(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [sandboxId, sandbox] of this.sandboxWorkflows.entries()) {
      if (now > sandbox.expiresAt.getTime()) {
        this.cleanupSandbox(sandboxId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info({ cleanedCount }, 'Cleaned up expired sandboxes')
    }
  }

  /**
   * Generate unique sandbox ID
   */
  private generateSandboxId(): string {
    return `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get sandbox statistics
   */
  getStats(): {
    totalSandboxes: number
    activeSandboxes: number
    expiredSandboxes: number
    runningExecutions: number
  } {
    const now = Date.now()
    let active = 0
    let expired = 0
    let running = 0

    for (const sandbox of this.sandboxWorkflows.values()) {
      if (now > sandbox.expiresAt.getTime()) {
        expired++
      } else {
        active++
      }

      if (sandbox.status === 'running') {
        running++
      }
    }

    return {
      totalSandboxes: this.sandboxWorkflows.size,
      activeSandboxes: active,
      expiredSandboxes: expired,
      runningExecutions: running
    }
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval)
    
    // Cleanup all sandboxes
    const sandboxIds = Array.from(this.sandboxWorkflows.keys())
    await Promise.all(sandboxIds.map(id => this.cleanupSandbox(id)))
    
    logger.info('Sandbox service shutdown completed')
  }
}

// Export singleton instance
export const sandboxService = new SandboxService()