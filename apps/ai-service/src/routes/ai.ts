import { FastifyInstance } from 'fastify'
import { AuthenticatedRequest } from '@/middleware/auth'
import { modelRouter } from '@/services/modelRouter'
import { blueprintTranslator } from '@/services/blueprint'
import { sandboxService } from '@/services/sandbox'
import { db } from '@/services/database'
import { redactPII } from '@/utils/redact'
import { logger, logBudgetCheck } from '@/utils/logger'
import { 
  validateRequest, 
  workflowGenerationSchema,
  errorAnalysisSchema,
  optimizationSchema,
  aiRequestSchema
} from '@/utils/validators'

export default async function aiRoutes(fastify: FastifyInstance) {
  
  // Generate workflow from prompt
  fastify.post('/generate-workflow', async (request: AuthenticatedRequest, reply) => {
    const { prompt, tenantId, context } = validateRequest(workflowGenerationSchema, request.body)

    try {
      // Check budget limits
      const budgetCheck = await db.checkBudgetLimit(tenantId, 0.50) // Estimate $0.50 cost
      if (!budgetCheck.allowed) {
        logBudgetCheck({
          tenantId,
          spent: budgetCheck.usage.totalCost,
          limit: budgetCheck.budget.monthlyUsd,
          action: 'blocked'
        })
        
        reply.code(402).send({
          error: 'Budget Exceeded',
          message: budgetCheck.reason,
          budget: budgetCheck.budget,
          usage: budgetCheck.usage
        })
        return
      }

      // Check feature flags
      const flags = await db.getFeatureFlags(tenantId)
      if (!flags.playgroundEnabled) {
        reply.code(403).send({
          error: 'Feature Disabled',
          message: 'Workflow generation is not enabled for your plan'
        })
        return
      }

      // Redact PII from prompt
      const redactionResult = redactPII(prompt, { aggressive: true })
      if (redactionResult.foundPatterns.length > 0) {
        logger.warn({
          tenantId,
          foundPatterns: redactionResult.foundPatterns
        }, 'PII detected in workflow generation prompt')
      }

      // Create conversation
      const conversationId = await db.saveConversation({
        tenantId,
        userId: request.user.id,
        type: 'generate',
        messages: [{
          role: 'user',
          content: redactionResult.redactedText,
          timestamp: new Date().toISOString()
        }],
        metadata: { context, originalPrompt: prompt }
      })

      // Parse prompt to blueprint
      const blueprint = blueprintTranslator.parsePromptToBlueprint(redactionResult.redactedText)
      
      // Translate blueprint to n8n workflow
      const generatedWorkflow = blueprintTranslator.translateToN8nJSON(blueprint)

      // Create sandbox for validation
      let sandboxResult
      try {
        const { sandboxId } = await sandboxService.createSandbox(tenantId, generatedWorkflow, {
          mockData: { test: true },
          disableExternalCalls: true
        })

        sandboxResult = await sandboxService.runSandboxTest(sandboxId)
        
        // Cleanup sandbox
        await sandboxService.cleanupSandbox(sandboxId)
      } catch (sandboxError: any) {
        logger.warn({ error: sandboxError.message }, 'Sandbox validation failed')
        sandboxResult = {
          success: false,
          errors: [sandboxError.message],
          warnings: ['Sandbox validation could not be performed']
        }
      }

      // Save generated workflow
      const workflowId = await db.saveGeneratedWorkflow({
        conversationId,
        tenantId,
        prompt: redactionResult.redactedText,
        generatedJson: generatedWorkflow,
        validationResults: sandboxResult,
        metadata: {
          blueprint,
          context,
          complexity: generatedWorkflow.metadata.difficulty,
          estimatedTime: generatedWorkflow.metadata.estimatedExecutionTime
        }
      })

      // Log usage
      await db.logUsage({
        tenantId,
        userId: request.user.id,
        provider: 'blueprint_translator',
        tokensIn: redactionResult.redactedText.length / 4, // Approximate
        tokensOut: JSON.stringify(generatedWorkflow).length / 4,
        costUsd: 0.10, // Fixed cost for workflow generation
        latencyMs: Date.now(),
        action: 'generate',
        metadata: {
          workflowId,
          complexity: generatedWorkflow.metadata.difficulty,
          nodeCount: generatedWorkflow.nodes.length
        }
      })

      // Update conversation with result
      await db.updateConversation(conversationId, [
        {
          role: 'user',
          content: redactionResult.redactedText,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          content: `Workflow generado: ${generatedWorkflow.name}`,
          timestamp: new Date().toISOString(),
          metadata: { workflowId, sandboxResult }
        }
      ])

      reply.send({
        success: true,
        conversationId,
        workflowId,
        workflow: generatedWorkflow,
        validation: sandboxResult,
        metadata: {
          redactionApplied: redactionResult.foundPatterns.length > 0,
          budgetRemaining: budgetCheck.budget.monthlyUsd - budgetCheck.usage.totalCost
        }
      })

    } catch (error: any) {
      logger.error('Workflow generation error:', error)
      reply.code(500).send({
        error: 'Generation Failed',
        message: error.message
      })
    }
  })

  // Explain execution error
  fastify.post('/explain-error', async (request: AuthenticatedRequest, reply) => {
    const { executionId, workflowId, tenantId, errorLogs, workflowData } = validateRequest(
      errorAnalysisSchema, 
      request.body
    )

    try {
      // Check budget
      const budgetCheck = await db.checkBudgetLimit(tenantId, 0.30)
      if (!budgetCheck.allowed) {
        reply.code(402).send({
          error: 'Budget Exceeded',
          message: budgetCheck.reason
        })
        return
      }

      // Redact PII from error logs
      const redactedLogs = errorLogs.map(log => {
        if (typeof log === 'string') {
          return redactPII(log).redactedText
        }
        return log
      })

      // Create conversation
      const conversationId = await db.saveConversation({
        tenantId,
        userId: request.user.id,
        type: 'debug',
        messages: [{
          role: 'user',
          content: `Analizar error en ejecución ${executionId}`,
          timestamp: new Date().toISOString()
        }],
        metadata: { executionId, workflowId, errorCount: errorLogs.length }
      })

      // Build AI request for error analysis
      const aiRequest = {
        tenantId,
        userId: request.user.id,
        messages: [
          {
            role: 'system' as const,
            content: `Eres un experto en debugging de n8n. Analiza este error y proporciona una explicación clara y soluciones prácticas en español.

ESTRUCTURA DEL RESPONSE (JSON):
{
  "errorType": "tipo_del_error",
  "severity": "low|medium|high|critical",
  "explanation": "Explicación clara del error",
  "possibleCauses": ["causa1", "causa2"],
  "suggestedFixes": [
    {
      "title": "Título de la solución",
      "description": "Descripción detallada",
      "difficulty": "easy|medium|hard",
      "estimatedTime": 300,
      "steps": ["paso 1", "paso 2"],
      "autoApplicable": false
    }
  ],
  "preventionTips": ["tip1", "tip2"],
  "relatedDocumentation": [
    {
      "title": "Título del doc",
      "url": "https://docs.n8n.io/..."
    }
  ]
}`
          },
          {
            role: 'user' as const,
            content: `Analiza este error de n8n:

Execution ID: ${executionId}
Workflow ID: ${workflowId}

Error Logs:
${JSON.stringify(redactedLogs, null, 2)}

${workflowData ? `Workflow Context:
${JSON.stringify(workflowData, null, 2)}` : ''}`
          }
        ],
        provider: request.byok?.provider || 'auto',
        byokProvider: request.byok?.provider,
        byokKey: request.byok?.key
      }

      // Get AI analysis
      const aiResponse = await modelRouter.routeRequest(aiRequest)

      // Parse AI response
      let analysis
      try {
        analysis = JSON.parse(aiResponse.content)
      } catch (parseError) {
        // Fallback if not valid JSON
        analysis = {
          errorType: 'unknown',
          severity: 'medium',
          explanation: aiResponse.content,
          possibleCauses: ['Error analysis could not be parsed'],
          suggestedFixes: [],
          preventionTips: [],
          relatedDocumentation: []
        }
      }

      // Save error analysis
      await db.saveErrorAnalysis({
        tenantId,
        executionId,
        workflowId,
        errorType: analysis.errorType,
        severity: analysis.severity,
        mainError: redactedLogs[0]?.message || 'Unknown error',
        analysis
      })

      // Log usage
      await db.logUsage({
        tenantId,
        userId: request.user.id,
        provider: aiResponse.provider,
        tokensIn: aiResponse.tokens.input,
        tokensOut: aiResponse.tokens.output,
        costUsd: aiResponse.cost,
        latencyMs: aiResponse.latency,
        action: 'explain',
        metadata: {
          executionId,
          workflowId,
          errorType: analysis.errorType,
          severity: analysis.severity
        }
      })

      // Update conversation
      await db.updateConversation(conversationId, [
        {
          role: 'user',
          content: `Analizar error en ejecución ${executionId}`,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          content: `Análisis completado: ${analysis.errorType}`,
          timestamp: new Date().toISOString(),
          metadata: { analysis }
        }
      ])

      reply.send({
        success: true,
        conversationId,
        analysis: {
          ...analysis,
          executionId,
          workflowId,
          aiProvider: aiResponse.provider,
          cached: aiResponse.cached
        }
      })

    } catch (error: any) {
      logger.error('Error analysis failed:', error)
      reply.code(500).send({
        error: 'Analysis Failed',
        message: error.message
      })
    }
  })

  // Optimize workflow
  fastify.post('/optimize', async (request: AuthenticatedRequest, reply) => {
    const { workflowId, tenantId, workflowData, executionHistory } = validateRequest(
      optimizationSchema,
      request.body
    )

    try {
      // Check budget and flags
      const [budgetCheck, flags] = await Promise.all([
        db.checkBudgetLimit(tenantId, 0.40),
        db.getFeatureFlags(tenantId)
      ])

      if (!budgetCheck.allowed) {
        reply.code(402).send({
          error: 'Budget Exceeded',
          message: budgetCheck.reason
        })
        return
      }

      if (!flags.profilerEnabled) {
        reply.code(403).send({
          error: 'Feature Disabled',
          message: 'Workflow optimization is not enabled for your plan'
        })
        return
      }

      // Create conversation
      const conversationId = await db.saveConversation({
        tenantId,
        userId: request.user.id,
        type: 'optimize',
        messages: [{
          role: 'user',
          content: `Optimizar workflow ${workflowId}`,
          timestamp: new Date().toISOString()
        }],
        metadata: { workflowId, nodeCount: workflowData.nodes?.length || 0 }
      })

      // Analyze complexity
      const complexityAnalysis = this.analyzeWorkflowComplexity(workflowData)

      // Build AI request
      const aiRequest = {
        tenantId,
        userId: request.user.id,
        messages: [
          {
            role: 'system' as const,
            content: `Eres un experto en optimización de workflows n8n. Analiza este workflow y proporciona sugerencias específicas de optimización en español.

ESTRUCTURA DEL RESPONSE (JSON):
{
  "overallScore": 85,
  "summary": {
    "performance": "good",
    "reliability": "excellent", 
    "cost": "fair",
    "maintainability": "good"
  },
  "suggestions": [
    {
      "type": "performance",
      "priority": "high",
      "title": "Título de la sugerencia",
      "description": "Descripción detallada",
      "impact": {
        "performance": "20% más rápido",
        "cost": "30% menos API calls"
      },
      "implementation": {
        "difficulty": "medium",
        "estimatedTime": 1800,
        "steps": ["paso 1", "paso 2"],
        "codeChanges": []
      },
      "metrics": {
        "expectedSpeedup": "2x más rápido",
        "expectedCostReduction": "30% menos requests"
      }
    }
  ],
  "bestPractices": ["práctica 1", "práctica 2"],
  "architecturalRecommendations": ["recomendación 1", "recomendación 2"]
}`
          },
          {
            role: 'user' as const,
            content: `Analiza este workflow n8n y proporciona sugerencias de optimización:

Workflow ID: ${workflowId}
Node Count: ${workflowData.nodes?.length || 0}

Workflow JSON:
${JSON.stringify(workflowData, null, 2)}

${executionHistory ? `Execution History:
${JSON.stringify(executionHistory.slice(-5), null, 2)}` : ''}`
          }
        ],
        provider: request.byok?.provider || 'auto',
        byokProvider: request.byok?.provider,
        byokKey: request.byok?.key
      }

      // Get AI optimization analysis
      const aiResponse = await modelRouter.routeRequest(aiRequest)

      // Parse response
      let optimizationAnalysis
      try {
        optimizationAnalysis = JSON.parse(aiResponse.content)
      } catch (parseError) {
        optimizationAnalysis = {
          overallScore: 70,
          summary: { performance: 'unknown', reliability: 'unknown', cost: 'unknown', maintainability: 'unknown' },
          suggestions: [],
          bestPractices: [],
          architecturalRecommendations: [aiResponse.content]
        }
      }

      // Save optimization analysis
      await db.saveOptimizationAnalysis({
        tenantId,
        workflowId,
        conversationId,
        overallScore: optimizationAnalysis.overallScore,
        complexityAnalysis,
        optimizationAnalysis,
        suggestionsCount: optimizationAnalysis.suggestions?.length || 0
      })

      // Log usage
      await db.logUsage({
        tenantId,
        userId: request.user.id,
        provider: aiResponse.provider,
        tokensIn: aiResponse.tokens.input,
        tokensOut: aiResponse.tokens.output,
        costUsd: aiResponse.cost,
        latencyMs: aiResponse.latency,
        action: 'optimize',
        metadata: {
          workflowId,
          overallScore: optimizationAnalysis.overallScore,
          suggestionsCount: optimizationAnalysis.suggestions?.length || 0
        }
      })

      // Update conversation
      await db.updateConversation(conversationId, [
        {
          role: 'user',
          content: `Optimizar workflow ${workflowId}`,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant',
          content: 'Análisis de optimización completado',
          timestamp: new Date().toISOString(),
          metadata: { optimizationAnalysis }
        }
      ])

      reply.send({
        success: true,
        conversationId,
        workflowId,
        analysis: {
          ...optimizationAnalysis,
          complexity: complexityAnalysis,
          aiProvider: aiResponse.provider,
          cached: aiResponse.cached
        }
      })

    } catch (error: any) {
      logger.error('Optimization analysis failed:', error)
      reply.code(500).send({
        error: 'Optimization Failed',
        message: error.message
      })
    }
  })

  // General AI chat
  fastify.post('/chat', async (request: AuthenticatedRequest, reply) => {
    const { tenantId, messages, context } = validateRequest(aiRequestSchema, request.body)

    try {
      // Check budget
      const budgetCheck = await db.checkBudgetLimit(tenantId, 0.20)
      if (!budgetCheck.allowed) {
        reply.code(402).send({
          error: 'Budget Exceeded',
          message: budgetCheck.reason
        })
        return
      }

      // Redact PII from messages
      const redactedMessages = messages.map(msg => ({
        ...msg,
        content: redactPII(msg.content).redactedText
      }))

      // Create or get conversation
      let conversationId = context?.conversationId
      if (!conversationId) {
        conversationId = await db.saveConversation({
          tenantId,
          userId: request.user.id,
          type: 'chat',
          messages: redactedMessages,
          metadata: context
        })
      }

      // Build AI request
      const aiRequest = {
        tenantId,
        userId: request.user.id,
        messages: [
          {
            role: 'system' as const,
            content: `Eres el AI Assistant de RP9, un experto en automatización empresarial con n8n. Tu personalidad es profesional pero amigable, y siempre respondes en español.

CAPACIDADES:
1. Soporte técnico: Ayudo con configuración, debugging y optimización de workflows
2. Consultoría: Sugiero mejores prácticas y arquitecturas de automatización
3. Educación: Explico conceptos complejos de forma simple
4. Generación: Puedo crear workflows, documentación y scripts

CONTEXTO DE RP9:
- Plataforma de automatización empresarial basada en n8n
- Enfoque en LatAm con soporte primario en español
- Integra con múltiples APIs: CRMs, ERPs, contabilidad, etc.
- Planes: Starter, Pro, Enterprise con diferentes límites

PERSONALIDAD:
- Profesional pero cercano
- Proactivo en sugerir mejoras
- Paciente para explicar conceptos técnicos
- Orientado a soluciones prácticas`
          },
          ...redactedMessages
        ],
        provider: request.byok?.provider || 'auto',
        byokProvider: request.byok?.provider,
        byokKey: request.byok?.key,
        context
      }

      // Get AI response
      const aiResponse = await modelRouter.routeRequest(aiRequest)

      // Log usage
      await db.logUsage({
        tenantId,
        userId: request.user.id,
        provider: aiResponse.provider,
        tokensIn: aiResponse.tokens.input,
        tokensOut: aiResponse.tokens.output,
        costUsd: aiResponse.cost,
        latencyMs: aiResponse.latency,
        action: 'chat',
        metadata: {
          conversationId,
          messageCount: messages.length
        }
      })

      // Update conversation
      const updatedMessages = [
        ...redactedMessages,
        {
          role: 'assistant' as const,
          content: aiResponse.content,
          timestamp: new Date().toISOString()
        }
      ]

      await db.updateConversation(conversationId, updatedMessages, context)

      reply.send({
        success: true,
        conversationId,
        response: aiResponse.content,
        metadata: {
          provider: aiResponse.provider,
          cached: aiResponse.cached,
          tokens: aiResponse.tokens,
          cost: aiResponse.cost
        }
      })

    } catch (error: any) {
      logger.error('Chat failed:', error)
      reply.code(500).send({
        error: 'Chat Failed',
        message: error.message
      })
    }
  })

  // Helper method for complexity analysis
  function analyzeWorkflowComplexity(workflowData: any): {
    complexity: 'low' | 'medium' | 'high'
    factors: string[]
    score: number
  } {
    let score = 0
    const factors: string[] = []

    const nodeCount = workflowData.nodes?.length || 0
    
    if (nodeCount > 20) {
      score += 30
      factors.push(`Workflow grande (${nodeCount} nodos)`)
    } else if (nodeCount > 10) {
      score += 15
      factors.push(`Workflow mediano (${nodeCount} nodos)`)
    }

    const hasLoops = workflowData.nodes?.some((n: any) => 
      n.type === 'n8n-nodes-base.splitInBatches' || 
      n.type === 'n8n-nodes-base.itemLists'
    )
    if (hasLoops) {
      score += 20
      factors.push('Contiene loops/batching')
    }

    const conditionalCount = workflowData.nodes?.filter((n: any) => 
      n.type === 'n8n-nodes-base.if' || 
      n.type === 'n8n-nodes-base.switch'
    ).length || 0
    if (conditionalCount > 3) {
      score += 15
      factors.push(`Múltiples condicionales (${conditionalCount})`)
    }

    let complexity: 'low' | 'medium' | 'high' = 'low'
    if (score > 50) complexity = 'high'
    else if (score > 25) complexity = 'medium'

    return { complexity, factors, score }
  }
}

// Usage routes
fastify.register(async function usageRoutes(fastify) {
  fastify.get('/usage/:tenantId', async (request: AuthenticatedRequest, reply) => {
    const { tenantId } = request.params as { tenantId: string }

    try {
      const [budget, usage] = await Promise.all([
        db.getBudget(tenantId),
        db.getMonthlyUsage(tenantId)
      ])

      reply.send({
        budget,
        usage,
        remainingBudget: budget.monthlyUsd - usage.totalCost,
        percentUsed: Math.round((usage.totalCost / budget.monthlyUsd) * 100)
      })

    } catch (error: any) {
      reply.code(500).send({
        error: 'Failed to get usage',
        message: error.message
      })
    }
  })
}