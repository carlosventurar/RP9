import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ModelRouter } from '../services/modelRouter.js'
import { redactPII } from '../utils/redact.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const executeSchema = z.object({
  tenantId: z.string().uuid(),
  prompt: z.string().min(1),
  variables: z.record(z.string()).optional(),
  model: z.string().optional().default('gpt-4'),
  templateId: z.string().optional(),
  userId: z.string().uuid()
})

const evaluateSchema = z.object({
  tenantId: z.string().uuid(),
  prompt: z.string().min(1),
  responses: z.array(z.object({
    provider: z.string(),
    model: z.string(),
    response: z.string(),
    tokensUsed: z.number(),
    costUsd: z.number(),
    executionTime: z.number()
  })),
  criteria: z.array(z.string()).optional(),
  userId: z.string().uuid()
})

async function playgroundRoutes(fastify: FastifyInstance) {
  const modelRouter = new ModelRouter()

  // Execute prompt in playground
  fastify.post('/playground/execute', async (request, reply) => {
    try {
      const body = executeSchema.parse(request.body)
      const startTime = Date.now()

      // Check budget first
      const { data: budget } = await supabase
        .from('ai_budgets')
        .select('monthly_usd, spent_usd, hard_limit_behavior')
        .eq('tenant_id', body.tenantId)
        .single()

      const monthlyLimit = budget?.monthly_usd || 20
      const spentThisMonth = budget?.spent_usd || 0
      const remainingBudget = monthlyLimit - spentThisMonth

      if (remainingBudget <= 0 && budget?.hard_limit_behavior === 'block') {
        return reply.code(402).send({
          error: 'Budget limit exceeded',
          budget: {
            monthlyLimit,
            spent: spentThisMonth,
            remaining: remainingBudget
          }
        })
      }

      // Redact PII from prompt
      const redactionResult = redactPII(body.prompt)
      const sanitizedPrompt = redactionResult.redactedText

      if (redactionResult.foundPII.length > 0) {
        fastify.log.warn('PII detected in playground prompt', {
          tenantId: body.tenantId,
          userId: body.userId,
          piiTypes: redactionResult.foundPII.map(p => p.type)
        })
      }

      // Route to AI model
      const aiResponse = await modelRouter.routeRequest({
        tenantId: body.tenantId,
        userId: body.userId,
        action: 'playground',
        prompt: sanitizedPrompt,
        model: body.model,
        metadata: {
          templateId: body.templateId,
          variables: body.variables,
          originalPrompt: body.prompt,
          piiRedacted: redactionResult.foundPII.length > 0
        }
      })

      const executionTime = Date.now() - startTime

      // Save conversation if successful
      if (aiResponse.success) {
        const conversation = {
          id: crypto.randomUUID(),
          tenant_id: body.tenantId,
          user_id: body.userId,
          type: 'playground',
          messages: [
            {
              role: 'user',
              content: body.prompt,
              timestamp: new Date().toISOString()
            },
            {
              role: 'assistant',
              content: aiResponse.response,
              timestamp: new Date().toISOString(),
              metadata: {
                provider: aiResponse.provider,
                model: aiResponse.model,
                tokensUsed: aiResponse.tokensUsed,
                costUsd: aiResponse.costUsd
              }
            }
          ],
          metadata: {
            templateId: body.templateId,
            variables: body.variables,
            executionTime,
            piiRedacted: redactionResult.foundPII.length > 0
          }
        }

        await supabase
          .from('ai_conversations')
          .insert(conversation)
      }

      // Log usage
      await supabase
        .from('ai_usage')
        .insert({
          tenant_id: body.tenantId,
          user_id: body.userId,
          action: 'playground',
          provider: aiResponse.provider,
          model: aiResponse.model || body.model,
          prompt_tokens: aiResponse.promptTokens || 0,
          completion_tokens: aiResponse.completionTokens || 0,
          total_tokens: aiResponse.tokensUsed || 0,
          cost_usd: aiResponse.costUsd || 0,
          metadata: {
            templateId: body.templateId,
            variables: body.variables,
            executionTime,
            piiRedacted: redactionResult.foundPII.length > 0
          }
        })

      // Update budget
      if (budget && aiResponse.costUsd) {
        await supabase
          .from('ai_budgets')
          .update({ 
            spent_usd: spentThisMonth + aiResponse.costUsd 
          })
          .eq('tenant_id', body.tenantId)
      }

      // Update template usage if provided
      if (body.templateId && aiResponse.success) {
        await supabase
          .from('ai_prompt_templates')
          .update({ 
            usage_count: supabase.raw('usage_count + 1'),
            updated_at: new Date().toISOString()
          })
          .eq('id', body.templateId)
      }

      return {
        success: aiResponse.success,
        response: aiResponse.response,
        tokensUsed: aiResponse.tokensUsed,
        costUsd: aiResponse.costUsd,
        provider: aiResponse.provider,
        model: aiResponse.model || body.model,
        executionTime,
        piiRedacted: redactionResult.foundPII.length > 0,
        redactedTypes: redactionResult.foundPII.map(p => p.type),
        error: aiResponse.error
      }

    } catch (error: any) {
      fastify.log.error('Playground execute error:', error)
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      })
    }
  })

  // Compare multiple model responses
  fastify.post('/playground/compare', async (request, reply) => {
    try {
      const body = z.object({
        tenantId: z.string().uuid(),
        prompt: z.string().min(1),
        models: z.array(z.string()).min(2).max(4),
        userId: z.string().uuid()
      }).parse(request.body)

      // Check budget
      const { data: budget } = await supabase
        .from('ai_budgets')
        .select('monthly_usd, spent_usd, hard_limit_behavior')
        .eq('tenant_id', body.tenantId)
        .single()

      const monthlyLimit = budget?.monthly_usd || 20
      const spentThisMonth = budget?.spent_usd || 0
      const remainingBudget = monthlyLimit - spentThisMonth

      if (remainingBudget <= 5 && budget?.hard_limit_behavior === 'block') {
        return reply.code(402).send({
          error: 'Insufficient budget for comparison',
          message: 'Model comparison requires higher budget'
        })
      }

      // Redact PII
      const redactionResult = redactPII(body.prompt)
      const sanitizedPrompt = redactionResult.redactedText

      // Execute with each model
      const results = []
      let totalCost = 0

      for (const model of body.models) {
        try {
          const startTime = Date.now()
          
          const aiResponse = await modelRouter.routeRequest({
            tenantId: body.tenantId,
            userId: body.userId,
            action: 'playground-compare',
            prompt: sanitizedPrompt,
            model,
            metadata: {
              comparisonGroup: crypto.randomUUID(),
              originalPrompt: body.prompt
            }
          })

          const executionTime = Date.now() - startTime
          totalCost += aiResponse.costUsd || 0

          results.push({
            model,
            provider: aiResponse.provider,
            response: aiResponse.response,
            tokensUsed: aiResponse.tokensUsed,
            costUsd: aiResponse.costUsd,
            executionTime,
            success: aiResponse.success,
            error: aiResponse.error
          })

          // Log usage
          await supabase
            .from('ai_usage')
            .insert({
              tenant_id: body.tenantId,
              user_id: body.userId,
              action: 'playground-compare',
              provider: aiResponse.provider,
              model: model,
              prompt_tokens: aiResponse.promptTokens || 0,
              completion_tokens: aiResponse.completionTokens || 0,
              total_tokens: aiResponse.tokensUsed || 0,
              cost_usd: aiResponse.costUsd || 0,
              metadata: {
                comparisonGroup: true,
                executionTime,
                piiRedacted: redactionResult.foundPII.length > 0
              }
            })

        } catch (error) {
          fastify.log.error(`Model ${model} comparison failed:`, error)
          results.push({
            model,
            provider: 'unknown',
            response: '',
            tokensUsed: 0,
            costUsd: 0,
            executionTime: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Update budget
      if (budget && totalCost > 0) {
        await supabase
          .from('ai_budgets')
          .update({ 
            spent_usd: spentThisMonth + totalCost 
          })
          .eq('tenant_id', body.tenantId)
      }

      return {
        success: true,
        prompt: body.prompt,
        results,
        totalCost,
        piiRedacted: redactionResult.foundPII.length > 0,
        comparison: {
          fastestModel: results.reduce((prev, curr) => 
            (prev.executionTime < curr.executionTime && prev.success) ? prev : curr
          ),
          cheapestModel: results.reduce((prev, curr) => 
            (prev.costUsd < curr.costUsd && prev.success) ? prev : curr
          ),
          mostTokens: results.reduce((prev, curr) => 
            (prev.tokensUsed > curr.tokensUsed) ? prev : curr
          )
        }
      }

    } catch (error: any) {
      fastify.log.error('Playground compare error:', error)
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      })
    }
  })

  // Evaluate responses with AI
  fastify.post('/playground/evaluate', async (request, reply) => {
    try {
      const body = evaluateSchema.parse(request.body)

      const evaluationPrompt = `
Evalúa las siguientes respuestas de IA para el prompt: "${body.prompt}"

Criterios de evaluación: ${body.criteria?.join(', ') || 'relevancia, precisión, claridad, utilidad'}

Respuestas:
${body.responses.map((r, i) => `
${i + 1}. ${r.provider}/${r.model} (${r.tokensUsed} tokens, $${r.costUsd}, ${r.executionTime}ms):
${r.response}
`).join('\n')}

Por favor evalúa cada respuesta puntuando del 1-10 en cada criterio y proporciona:
1. Puntuación total por respuesta
2. Mejor respuesta y por qué
3. Análisis de fortalezas y debilidades
4. Recomendación de modelo según el uso

Responde en formato JSON con estructura clara.
      `

      const evaluationResponse = await modelRouter.routeRequest({
        tenantId: body.tenantId,
        userId: body.userId,
        action: 'playground-evaluate',
        prompt: evaluationPrompt,
        model: 'gpt-4',
        metadata: {
          evaluating: body.responses.length,
          criteria: body.criteria
        }
      })

      return {
        success: true,
        evaluation: evaluationResponse.response,
        evaluationCost: evaluationResponse.costUsd,
        evaluatedResponses: body.responses.length
      }

    } catch (error: any) {
      fastify.log.error('Playground evaluate error:', error)
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      })
    }
  })
}

export default playgroundRoutes