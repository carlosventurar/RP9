export interface AIProvider {
  name: 'openai' | 'anthropic' | 'byok:openai' | 'byok:anthropic'
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface AIRequest {
  tenantId: string
  userId: string
  messages: ChatMessage[]
  context?: Record<string, any>
  provider?: 'auto' | 'openai' | 'anthropic'
  byokProvider?: string
  byokKey?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  metadata?: Record<string, any>
}

export interface AIResponse {
  content: string
  provider: string
  tokens: {
    input: number
    output: number
  }
  cost: number
  latency: number
  cached: boolean
}

export interface WorkflowGenerationRequest {
  prompt: string
  tenantId: string
  userId: string
  context?: {
    existingWorkflows?: string[]
    integrations?: string[]
    complexity?: 'simple' | 'medium' | 'complex'
  }
}

export interface GeneratedWorkflow {
  name: string
  description: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  metadata: {
    category: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    estimatedExecutionTime: number
    requiredCredentials: string[]
    setupInstructions: string[]
  }
}

export interface WorkflowNode {
  id: string
  name: string
  type: string
  position: [number, number]
  parameters: Record<string, any>
  credentials?: Record<string, string>
}

export interface WorkflowConnection {
  node: string
  type: string
  index: number
}

export interface ErrorAnalysisRequest {
  executionId: string
  workflowId: string
  tenantId: string
  userId: string
  errorLogs: any[]
  workflowData?: any
}

export interface ErrorAnalysis {
  errorType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
  possibleCauses: string[]
  suggestedFixes: Array<{
    title: string
    description: string
    difficulty: 'easy' | 'medium' | 'hard'
    estimatedTime: number
    steps: string[]
    autoApplicable: boolean
  }>
  preventionTips: string[]
  relatedDocumentation: Array<{
    title: string
    url: string
  }>
}

export interface OptimizationRequest {
  workflowId: string
  tenantId: string
  userId: string
  workflowData: any
  executionHistory?: Array<{
    executionId: string
    duration: number
    status: string
    timestamp: string
    nodeStats?: Record<string, any>
  }>
}

export interface OptimizationAnalysis {
  overallScore: number
  summary: {
    performance: 'poor' | 'fair' | 'good' | 'excellent'
    reliability: 'poor' | 'fair' | 'good' | 'excellent'
    cost: 'poor' | 'fair' | 'good' | 'excellent'
    maintainability: 'poor' | 'fair' | 'good' | 'excellent'
  }
  suggestions: OptimizationSuggestion[]
  bestPractices: string[]
  architecturalRecommendations: string[]
}

export interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'cost' | 'maintainability'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: {
    performance?: string
    cost?: string
    reliability?: string
  }
  implementation: {
    difficulty: 'easy' | 'medium' | 'hard'
    estimatedTime: number
    steps: string[]
    codeChanges?: Array<{
      nodeId: string
      nodeName: string
      currentConfig: any
      suggestedConfig: any
      reason: string
    }>
  }
  metrics: {
    expectedSpeedup?: string
    expectedCostReduction?: string
    expectedErrorReduction?: string
  }
}

export interface Blueprint {
  source: {
    type: 'webhook' | 'cron' | 'manual' | 'http'
    config: Record<string, any>
  }
  transforms: Array<{
    type: 'filter' | 'map' | 'aggregate' | 'split' | 'merge'
    config: Record<string, any>
  }>
  destinations: Array<{
    type: 'http' | 'email' | 'database' | 'webhook' | 'file'
    config: Record<string, any>
  }>
  metadata: {
    name: string
    description: string
    tags: string[]
  }
}

export interface CacheEntry {
  key: string
  value: any
  ttl: number
  created: number
}

export interface UsageBudget {
  tenantId: string
  monthlyUsd: number
  spentUsd: number
  hardLimitBehavior: 'block' | 'warn'
}

export interface AIUsageLog {
  tenantId: string
  userId: string
  provider: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  latencyMs: number
  action: 'generate' | 'explain' | 'optimize' | 'chat'
  accepted?: boolean
  metadata: Record<string, any>
}

export interface FeatureFlags {
  tenantId: string
  autoFixEnabled: boolean
  profilerEnabled: boolean
  playgroundEnabled: boolean
}