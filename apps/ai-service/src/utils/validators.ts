import { z } from 'zod'
import { config } from './config'
import { logger } from './logger'

// Base schemas
export const tenantIdSchema = z.string().uuid('Invalid tenant ID format')
export const userIdSchema = z.string().uuid('Invalid user ID format')

// AI Request schemas
export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1, 'Message content cannot be empty').max(10000, 'Message too long'),
  metadata: z.record(z.any()).optional()
})

export const aiRequestSchema = z.object({
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  messages: z.array(chatMessageSchema).min(1, 'At least one message required'),
  context: z.record(z.any()).optional(),
  provider: z.enum(['auto', 'openai', 'anthropic']).optional(),
  byokProvider: z.string().optional(),
  byokKey: z.string().optional()
})

// Workflow Generation schemas
export const workflowGenerationSchema = z.object({
  prompt: z.string()
    .min(10, 'Prompt too short - provide more details')
    .max(2000, 'Prompt too long - keep it under 2000 characters'),
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  context: z.object({
    existingWorkflows: z.array(z.string()).optional(),
    integrations: z.array(z.string()).optional(),
    complexity: z.enum(['simple', 'medium', 'complex']).optional()
  }).optional()
})

// Error Analysis schemas
export const errorAnalysisSchema = z.object({
  executionId: z.string().min(1, 'Execution ID required'),
  workflowId: z.string().min(1, 'Workflow ID required'),
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  errorLogs: z.array(z.any()).min(1, 'Error logs required'),
  workflowData: z.any().optional()
})

// Optimization schemas
export const optimizationSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID required'),
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  workflowData: z.any(),
  executionHistory: z.array(z.object({
    executionId: z.string(),
    duration: z.number().min(0),
    status: z.string(),
    timestamp: z.string(),
    nodeStats: z.record(z.any()).optional()
  })).optional()
})

// Budget and usage schemas
export const budgetSchema = z.object({
  tenantId: tenantIdSchema,
  monthlyUsd: z.number().min(0).max(10000, 'Budget cannot exceed $10,000'),
  hardLimitBehavior: z.enum(['block', 'warn'])
})

export const usageLogSchema = z.object({
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  provider: z.string(),
  tokensIn: z.number().min(0),
  tokensOut: z.number().min(0),
  costUsd: z.number().min(0),
  latencyMs: z.number().min(0),
  action: z.enum(['generate', 'explain', 'optimize', 'chat']),
  accepted: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
})

// Workflow validation schemas
export const workflowNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  position: z.tuple([z.number(), z.number()]),
  parameters: z.record(z.any()),
  credentials: z.record(z.string()).optional()
})

export const workflowConnectionSchema = z.object({
  node: z.string(),
  type: z.string(),
  index: z.number()
})

export const generatedWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  nodes: z.array(workflowNodeSchema).min(1),
  connections: z.array(workflowConnectionSchema),
  metadata: z.object({
    category: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    estimatedExecutionTime: z.number().min(0),
    requiredCredentials: z.array(z.string()),
    setupInstructions: z.array(z.string())
  })
})

// Content validation functions
export class ContentValidator {
  /**
   * Validate prompt content for safety and appropriateness
   */
  static validatePrompt(prompt: string): {
    valid: boolean
    issues: string[]
    riskLevel: 'low' | 'medium' | 'high'
  } {
    const issues: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    // Check for malicious patterns
    const maliciousPatterns = [
      /ignore\s+previous\s+instructions/i,
      /forget\s+everything/i,
      /act\s+as\s+if/i,
      /pretend\s+to\s+be/i,
      /jailbreak/i,
      /exploit/i,
      /hack/i,
      /<script>/i,
      /javascript:/i,
      /data:text\/html/i
    ]

    for (const pattern of maliciousPatterns) {
      if (pattern.test(prompt)) {
        issues.push('Potentially malicious content detected')
        riskLevel = 'high'
        break
      }
    }

    // Check for PII in prompts
    const piiPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      /\+\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/,
      /\b(?:\d{4}[\s-]?){3}\d{4}\b/
    ]

    for (const pattern of piiPatterns) {
      if (pattern.test(prompt)) {
        issues.push('Personal information detected in prompt')
        if (riskLevel === 'low') riskLevel = 'medium'
        break
      }
    }

    // Check length
    if (prompt.length > 2000) {
      issues.push('Prompt exceeds maximum length')
    }

    if (prompt.length < 10) {
      issues.push('Prompt too short for meaningful processing')
    }

    // Check for excessive repetition
    const words = prompt.toLowerCase().split(/\s+/)
    const uniqueWords = new Set(words)
    const repetitionRatio = uniqueWords.size / words.length

    if (repetitionRatio < 0.3 && words.length > 20) {
      issues.push('Excessive repetition detected')
      if (riskLevel === 'low') riskLevel = 'medium'
    }

    return {
      valid: issues.length === 0,
      issues,
      riskLevel
    }
  }

  /**
   * Validate workflow JSON structure
   */
  static validateWorkflowJSON(workflow: any): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Basic structure validation
      if (!workflow || typeof workflow !== 'object') {
        errors.push('Workflow must be a valid JSON object')
        return { valid: false, errors, warnings }
      }

      if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
        errors.push('Workflow must have a nodes array')
      }

      if (!workflow.connections || typeof workflow.connections !== 'object') {
        warnings.push('Workflow connections not properly defined')
      }

      // Validate nodes
      if (workflow.nodes) {
        const nodeIds = new Set()
        let hasTrigger = false

        for (const [index, node] of workflow.nodes.entries()) {
          if (!node.id) {
            errors.push(`Node at index ${index} missing id`)
          } else {
            if (nodeIds.has(node.id)) {
              errors.push(`Duplicate node id: ${node.id}`)
            }
            nodeIds.add(node.id)
          }

          if (!node.type) {
            errors.push(`Node ${node.id} missing type`)
          }

          if (!node.name) {
            warnings.push(`Node ${node.id} missing name`)
          }

          // Check for trigger nodes
          const triggerTypes = [
            'n8n-nodes-base.start',
            'n8n-nodes-base.manualTrigger',
            'n8n-nodes-base.webhook',
            'n8n-nodes-base.cron'
          ]

          if (triggerTypes.includes(node.type)) {
            hasTrigger = true
          }

          // Validate position
          if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
            warnings.push(`Node ${node.id} has invalid position`)
          }
        }

        if (!hasTrigger) {
          errors.push('Workflow must have at least one trigger node')
        }

        // Check for orphaned nodes
        if (workflow.connections) {
          const connectedNodes = new Set()
          Object.values(workflow.connections).forEach((connections: any) => {
            if (connections && typeof connections === 'object') {
              Object.values(connections).forEach((connectionArray: any) => {
                if (Array.isArray(connectionArray)) {
                  connectionArray.forEach((connection: any) => {
                    if (connection && connection.node) {
                      connectedNodes.add(connection.node)
                    }
                  })
                }
              })
            }
          })

          const orphanedNodes = workflow.nodes
            .filter((node: any) => !connectedNodes.has(node.id) && !triggerTypes.includes(node.type))
            .map((node: any) => node.id)

          if (orphanedNodes.length > 0) {
            warnings.push(`Orphaned nodes detected: ${orphanedNodes.join(', ')}`)
          }
        }
      }

      // Check for security issues
      if (JSON.stringify(workflow).includes('<script>')) {
        errors.push('Workflow contains potentially malicious script content')
      }

      // Check workflow complexity
      if (workflow.nodes && workflow.nodes.length > 50) {
        warnings.push('Workflow is very complex (>50 nodes) - consider breaking into smaller workflows')
      }

    } catch (error: any) {
      errors.push(`Workflow validation error: ${error.message}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate and sanitize user input
   */
  static sanitizeInput(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      return ''
    }

    // Remove potentially dangerous characters
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:text\/html/gi, '') // Remove data URLs
      .trim()

    // Truncate if too long
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...'
    }

    return sanitized
  }

  /**
   * Validate request rate limits
   */
  static validateRateLimit(requests: number, timeWindow: number, maxRequests: number): {
    allowed: boolean
    remainingRequests: number
    resetTime: number
  } {
    const allowed = requests < maxRequests
    const remainingRequests = Math.max(0, maxRequests - requests)
    const resetTime = Date.now() + timeWindow

    return {
      allowed,
      remainingRequests,
      resetTime
    }
  }

  /**
   * Validate cost estimation
   */
  static validateCostEstimate(tokens: number, provider: string): {
    estimatedCost: number
    withinBudget: boolean
    costBreakdown: {
      tokensUsed: number
      ratePerToken: number
      totalCost: number
    }
  } {
    // Simplified cost calculation
    const rates: Record<string, number> = {
      'openai': 0.00002, // $0.02 per 1K tokens
      'anthropic': 0.00003, // $0.03 per 1K tokens
      'default': config.COST_PER_1K_TOKENS_USD / 1000
    }

    const rate = rates[provider] || rates.default
    const estimatedCost = tokens * rate

    return {
      estimatedCost,
      withinBudget: estimatedCost < 1.0, // Basic check
      costBreakdown: {
        tokensUsed: tokens,
        ratePerToken: rate,
        totalCost: estimatedCost
      }
    }
  }
}

// Export validation functions
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ')
      
      logger.warn({
        validation_errors: error.errors,
        input_data: data
      }, 'Validation failed')
      
      throw new Error(`Validation failed: ${issues}`)
    }
    throw error
  }
}

export function validateAndSanitize(input: any, schema: z.ZodSchema): any {
  // First sanitize string inputs
  if (typeof input === 'object' && input !== null) {
    const sanitized = { ...input }
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        sanitized[key] = ContentValidator.sanitizeInput(value)
      }
    }
    return validateRequest(schema, sanitized)
  }
  
  return validateRequest(schema, input)
}