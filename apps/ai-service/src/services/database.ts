import { createClient } from '@supabase/supabase-js'
import { config } from '@/utils/config'
import { logger, logError } from '@/utils/logger'
import type { AIUsageLog, UsageBudget, FeatureFlags } from '@/types'

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)

export class DatabaseService {
  /**
   * Log AI usage for billing and analytics
   */
  async logUsage(usage: AIUsageLog): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_usage')
        .insert({
          tenant_id: usage.tenantId,
          user_id: usage.userId,
          provider: usage.provider,
          tokens_in: usage.tokensIn,
          tokens_out: usage.tokensOut,
          cost_usd: usage.costUsd,
          latency_ms: usage.latencyMs,
          action: usage.action,
          accepted: usage.accepted,
          meta: usage.metadata
        })

      if (error) {
        throw error
      }

      logger.debug({
        tenantId: usage.tenantId,
        action: usage.action,
        cost: usage.costUsd
      }, 'Usage logged')

    } catch (error: any) {
      logError(error, { usage })
      throw new Error(`Failed to log usage: ${error.message}`)
    }
  }

  /**
   * Get usage budget for tenant
   */
  async getBudget(tenantId: string): Promise<UsageBudget> {
    try {
      const { data, error } = await supabase
        .from('ai_budgets')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error
      }

      if (!data) {
        // Create default budget
        const defaultBudget = {
          tenant_id: tenantId,
          monthly_usd: config.AI_BUDGET_DEFAULT_USD,
          spent_usd: 0,
          hard_limit_behavior: config.BUDGET_ENFORCEMENT
        }

        const { data: created, error: createError } = await supabase
          .from('ai_budgets')
          .insert(defaultBudget)
          .select()
          .single()

        if (createError) {
          throw createError
        }

        return {
          tenantId,
          monthlyUsd: created.monthly_usd,
          spentUsd: created.spent_usd,
          hardLimitBehavior: created.hard_limit_behavior
        }
      }

      return {
        tenantId: data.tenant_id,
        monthlyUsd: data.monthly_usd,
        spentUsd: data.spent_usd,
        hardLimitBehavior: data.hard_limit_behavior
      }

    } catch (error: any) {
      logError(error, { tenantId })
      throw new Error(`Failed to get budget: ${error.message}`)
    }
  }

  /**
   * Update budget spent amount
   */
  async updateBudgetSpent(tenantId: string, amount: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_budgets')
        .update({
          spent_usd: supabase.raw(`spent_usd + ${amount}`)
        })
        .eq('tenant_id', tenantId)

      if (error) {
        throw error
      }

    } catch (error: any) {
      logError(error, { tenantId, amount })
      throw new Error(`Failed to update budget: ${error.message}`)
    }
  }

  /**
   * Get monthly usage for tenant
   */
  async getMonthlyUsage(tenantId: string): Promise<{ totalCost: number; requestCount: number }> {
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('ai_usage')
        .select('cost_usd')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfMonth.toISOString())

      if (error) {
        throw error
      }

      const totalCost = data?.reduce((sum, record) => sum + (record.cost_usd || 0), 0) || 0
      const requestCount = data?.length || 0

      return { totalCost, requestCount }

    } catch (error: any) {
      logError(error, { tenantId })
      throw new Error(`Failed to get monthly usage: ${error.message}`)
    }
  }

  /**
   * Check if tenant can make AI requests based on budget
   */
  async checkBudgetLimit(tenantId: string, estimatedCost: number): Promise<{
    allowed: boolean
    reason?: string
    budget: UsageBudget
    usage: { totalCost: number; requestCount: number }
  }> {
    try {
      const [budget, usage] = await Promise.all([
        this.getBudget(tenantId),
        this.getMonthlyUsage(tenantId)
      ])

      const wouldExceed = (usage.totalCost + estimatedCost) > budget.monthlyUsd

      if (wouldExceed && budget.hardLimitBehavior === 'block') {
        return {
          allowed: false,
          reason: `Would exceed monthly budget of $${budget.monthlyUsd}. Current usage: $${usage.totalCost.toFixed(2)}`,
          budget,
          usage
        }
      }

      return {
        allowed: true,
        budget,
        usage
      }

    } catch (error: any) {
      logError(error, { tenantId })
      throw new Error(`Failed to check budget limit: ${error.message}`)
    }
  }

  /**
   * Get feature flags for tenant
   */
  async getFeatureFlags(tenantId: string): Promise<FeatureFlags> {
    try {
      const { data, error } = await supabase
        .from('ai_flags')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error
      }

      if (!data) {
        // Create default flags
        const defaultFlags = {
          tenant_id: tenantId,
          auto_fix_enabled: false,
          profiler_enabled: true,
          playground_enabled: true
        }

        const { data: created, error: createError } = await supabase
          .from('ai_flags')
          .insert(defaultFlags)
          .select()
          .single()

        if (createError) {
          throw createError
        }

        return {
          tenantId,
          autoFixEnabled: created.auto_fix_enabled,
          profilerEnabled: created.profiler_enabled,
          playgroundEnabled: created.playground_enabled
        }
      }

      return {
        tenantId: data.tenant_id,
        autoFixEnabled: data.auto_fix_enabled,
        profilerEnabled: data.profiler_enabled,
        playgroundEnabled: data.playground_enabled
      }

    } catch (error: any) {
      logError(error, { tenantId })
      throw new Error(`Failed to get feature flags: ${error.message}`)
    }
  }

  /**
   * Save AI conversation
   */
  async saveConversation(data: {
    tenantId: string
    userId: string
    type: string
    messages: any[]
    metadata?: any
  }): Promise<string> {
    try {
      const { data: conversation, error } = await supabase
        .from('ai_conversations')
        .insert({
          tenant_id: data.tenantId,
          user_id: data.userId,
          type: data.type,
          messages: data.messages,
          metadata: data.metadata || {}
        })
        .select('id')
        .single()

      if (error) {
        throw error
      }

      return conversation.id

    } catch (error: any) {
      logError(error, { data })
      throw new Error(`Failed to save conversation: ${error.message}`)
    }
  }

  /**
   * Update conversation with new messages
   */
  async updateConversation(conversationId: string, messages: any[], metadata?: any): Promise<void> {
    try {
      const updateData: any = {
        messages,
        updated_at: new Date().toISOString()
      }

      if (metadata) {
        updateData.metadata = metadata
      }

      const { error } = await supabase
        .from('ai_conversations')
        .update(updateData)
        .eq('id', conversationId)

      if (error) {
        throw error
      }

    } catch (error: any) {
      logError(error, { conversationId })
      throw new Error(`Failed to update conversation: ${error.message}`)
    }
  }

  /**
   * Save generated workflow
   */
  async saveGeneratedWorkflow(data: {
    conversationId: string
    tenantId: string
    prompt: string
    generatedJson: any
    validationResults: any
    metadata: any
  }): Promise<string> {
    try {
      const { data: workflow, error } = await supabase
        .from('ai_generated_workflows')
        .insert({
          conversation_id: data.conversationId,
          tenant_id: data.tenantId,
          prompt: data.prompt,
          generated_json: data.generatedJson,
          validation_results: data.validationResults,
          metadata: data.metadata
        })
        .select('id')
        .single()

      if (error) {
        throw error
      }

      return workflow.id

    } catch (error: any) {
      logError(error, { data })
      throw new Error(`Failed to save generated workflow: ${error.message}`)
    }
  }

  /**
   * Save error analysis
   */
  async saveErrorAnalysis(data: {
    tenantId: string
    executionId: string
    workflowId: string
    errorType: string
    severity: string
    mainError: string
    analysis: any
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('execution_errors')
        .insert({
          tenant_id: data.tenantId,
          execution_id: data.executionId,
          workflow_id: data.workflowId,
          error_type: data.errorType,
          severity: data.severity,
          main_error: data.mainError,
          analysis: data.analysis,
          resolved: false
        })

      if (error) {
        throw error
      }

    } catch (error: any) {
      logError(error, { data })
      throw new Error(`Failed to save error analysis: ${error.message}`)
    }
  }

  /**
   * Save optimization analysis
   */
  async saveOptimizationAnalysis(data: {
    tenantId: string
    workflowId: string
    conversationId: string
    overallScore: number
    complexityAnalysis: any
    optimizationAnalysis: any
    suggestionsCount: number
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('workflow_optimizations')
        .insert({
          tenant_id: data.tenantId,
          workflow_id: data.workflowId,
          conversation_id: data.conversationId,
          overall_score: data.overallScore,
          complexity_analysis: data.complexityAnalysis,
          optimization_analysis: data.optimizationAnalysis,
          suggestions_count: data.suggestionsCount,
          applied: false
        })

      if (error) {
        throw error
      }

    } catch (error: any) {
      logError(error, { data })
      throw new Error(`Failed to save optimization analysis: ${error.message}`)
    }
  }

  /**
   * Health check - test database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ai_usage')
        .select('count')
        .limit(1)

      return !error
    } catch (error: any) {
      logError(error)
      return false
    }
  }
}

// Export singleton instance
export const db = new DatabaseService()