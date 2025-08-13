import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Configuración de Health Score
interface HealthScoreConfig {
  weights: {
    usage: number        // 30% - Uso de la plataforma
    success: number      // 25% - Tasa de éxito de workflows
    incidents: number    // 20% - Incidentes y soporte
    nps: number         // 15% - NPS/CSAT scores
    engagement: number   // 10% - Engagement con producto
  }
  thresholds: {
    green: number    // 80-100
    yellow: number   // 60-79
    red: number      // 0-59
  }
}

const defaultConfig: HealthScoreConfig = {
  weights: {
    usage: 0.30,
    success: 0.25,
    incidents: 0.20,
    nps: 0.15,
    engagement: 0.10
  },
  thresholds: {
    green: 80,
    yellow: 60,
    red: 0
  }
}

// Validación de entrada (para cálculo manual)
const healthScoreSchema = z.object({
  tenantId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  forceRecalculate: z.boolean().optional().default(false)
})

// Cliente para obtener métricas de n8n
class N8nMetricsClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
  }

  async getExecutionMetrics(tenantId: string, days: number = 30) {
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      
      // En un entorno real, esto sería una llamada a la API de n8n filtrada por tenant
      // Por ahora usamos datos mock realistas
      const response = await fetch(`${this.baseUrl}/api/v1/executions`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`n8n API error: ${response.status}`)
      }

      // Mock data para desarrollo
      return this.generateMockMetrics(tenantId, days)
    } catch (error) {
      console.error('Error fetching n8n metrics:', error)
      // Fallback to mock data
      return this.generateMockMetrics(tenantId, days)
    }
  }

  private generateMockMetrics(tenantId: string, days: number) {
    // Generar métricas mock basadas en el tenant (para consistencia)
    const seed = tenantId.split('-')[0]
    const random = () => {
      const x = Math.sin(seed.length) * 10000
      return x - Math.floor(x)
    }

    const baseSuccess = 0.85 + (random() * 0.15) // 85-100%
    const totalExecutions = Math.floor(100 + random() * 500) // 100-600 ejecuciones
    const successfulExecutions = Math.floor(totalExecutions * baseSuccess)
    const failedExecutions = totalExecutions - successfulExecutions

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: successfulExecutions / totalExecutions,
      avgExecutionTime: 2500 + random() * 5000, // 2.5-7.5 segundos
      activeWorkflows: Math.floor(5 + random() * 20), // 5-25 workflows
      lastExecution: new Date(Date.now() - random() * 24 * 60 * 60 * 1000)
    }
  }
}

// Calculadores de Health Score por componente
class HealthScoreCalculator {
  private supabase: any
  private n8nClient: N8nMetricsClient | null

  constructor(supabase: any, n8nClient: N8nMetricsClient | null = null) {
    this.supabase = supabase
    this.n8nClient = n8nClient
  }

  async calculateUsageScore(tenantId: string, days: number = 30): Promise<{ score: number, details: any }> {
    try {
      if (!this.n8nClient) {
        // Fallback: usar datos desde nuestra BD
        return this.calculateUsageFromDB(tenantId, days)
      }

      const metrics = await this.n8nClient.getExecutionMetrics(tenantId, days)
      
      let score = 0
      const details: any = {
        totalExecutions: metrics.totalExecutions,
        activeWorkflows: metrics.activeWorkflows,
        avgExecutionTime: metrics.avgExecutionTime,
        lastExecution: metrics.lastExecution
      }

      // Componente 1: Frecuencia de uso (40%)
      const dailyExecutions = metrics.totalExecutions / days
      let usageFrequencyScore = 0
      if (dailyExecutions >= 20) usageFrequencyScore = 100
      else if (dailyExecutions >= 10) usageFrequencyScore = 80
      else if (dailyExecutions >= 5) usageFrequencyScore = 60
      else if (dailyExecutions >= 1) usageFrequencyScore = 40
      else usageFrequencyScore = 0

      // Componente 2: Actividad reciente (30%)
      const daysSinceLastExecution = Math.floor(
        (Date.now() - new Date(metrics.lastExecution).getTime()) / (1000 * 60 * 60 * 24)
      )
      let recentActivityScore = 0
      if (daysSinceLastExecution <= 1) recentActivityScore = 100
      else if (daysSinceLastExecution <= 3) recentActivityScore = 80
      else if (daysSinceLastExecution <= 7) recentActivityScore = 60
      else if (daysSinceLastExecution <= 14) recentActivityScore = 40
      else recentActivityScore = 0

      // Componente 3: Diversidad de workflows (20%)
      let workflowDiversityScore = 0
      if (metrics.activeWorkflows >= 10) workflowDiversityScore = 100
      else if (metrics.activeWorkflows >= 5) workflowDiversityScore = 80
      else if (metrics.activeWorkflows >= 3) workflowDiversityScore = 60
      else if (metrics.activeWorkflows >= 1) workflowDiversityScore = 40
      else workflowDiversityScore = 0

      // Componente 4: Performance (10%)
      let performanceScore = 0
      if (metrics.avgExecutionTime <= 3000) performanceScore = 100
      else if (metrics.avgExecutionTime <= 5000) performanceScore = 80
      else if (metrics.avgExecutionTime <= 10000) performanceScore = 60
      else if (metrics.avgExecutionTime <= 15000) performanceScore = 40
      else performanceScore = 0

      score = (
        usageFrequencyScore * 0.4 +
        recentActivityScore * 0.3 +
        workflowDiversityScore * 0.2 +
        performanceScore * 0.1
      )

      details.breakdown = {
        usageFrequency: usageFrequencyScore,
        recentActivity: recentActivityScore,
        workflowDiversity: workflowDiversityScore,
        performance: performanceScore
      }

      return { score: Math.round(score), details }
    } catch (error) {
      console.error('Error calculating usage score:', error)
      return { score: 50, details: { error: error.message } }
    }
  }

  private async calculateUsageFromDB(tenantId: string, days: number) {
    // Fallback usando datos de nuestra BD
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    
    // Mock implementation - en prod sería query real
    const mockData = {
      totalExecutions: 150,
      activeWorkflows: 8,
      avgExecutionTime: 4200,
      lastExecution: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 horas atrás
    }

    return { score: 75, details: mockData }
  }

  async calculateSuccessScore(tenantId: string, days: number = 30): Promise<{ score: number, details: any }> {
    try {
      const metrics = this.n8nClient 
        ? await this.n8nClient.getExecutionMetrics(tenantId, days)
        : await this.getMockSuccessMetrics(tenantId)

      let score = 0
      const details: any = {
        totalExecutions: metrics.totalExecutions,
        successfulExecutions: metrics.successfulExecutions,
        failedExecutions: metrics.failedExecutions,
        successRate: metrics.successRate
      }

      // Score basado en tasa de éxito
      const successRate = metrics.successRate * 100
      if (successRate >= 95) score = 100
      else if (successRate >= 90) score = 90
      else if (successRate >= 85) score = 80
      else if (successRate >= 80) score = 70
      else if (successRate >= 70) score = 60
      else if (successRate >= 60) score = 50
      else score = Math.max(0, successRate - 10)

      // Penalizar si hay muy pocas ejecuciones
      if (metrics.totalExecutions < 10) {
        score *= 0.7 // 30% de penalización
        details.lowVolumeWarning = true
      }

      return { score: Math.round(score), details }
    } catch (error) {
      console.error('Error calculating success score:', error)
      return { score: 50, details: { error: error.message } }
    }
  }

  async calculateIncidentsScore(tenantId: string, days: number = 30): Promise<{ score: number, details: any }> {
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // Obtener tickets e incidentes del período
      const { data: tickets } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', fromDate.toISOString())

      const { data: incidents } = await this.supabase
        .from('incidents')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', fromDate.toISOString())

      let score = 100 // Empezar con score perfecto
      const details: any = {
        totalTickets: tickets?.length || 0,
        totalIncidents: incidents?.length || 0,
        criticalIssues: 0,
        avgResolutionTime: 0
      }

      // Penalizar por tickets críticos
      const criticalTickets = tickets?.filter(t => t.severity === 'P1') || []
      details.criticalIssues = criticalTickets.length
      score -= criticalTickets.length * 20 // -20 por cada P1

      // Penalizar por tickets no resueltos
      const unresolvedTickets = tickets?.filter(t => t.status !== 'resolved' && t.status !== 'closed') || []
      score -= unresolvedTickets.length * 5 // -5 por cada ticket abierto

      // Penalizar por incidentes
      const criticalIncidents = incidents?.filter(i => i.severity === 'P1') || []
      score -= criticalIncidents.length * 30 // -30 por cada incidente P1

      // Calcular tiempo promedio de resolución
      const resolvedTickets = tickets?.filter(t => t.resolved_at) || []
      if (resolvedTickets.length > 0) {
        const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
          const created = new Date(ticket.created_at).getTime()
          const resolved = new Date(ticket.resolved_at).getTime()
          return sum + (resolved - created)
        }, 0)
        
        const avgResolutionHours = totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60)
        details.avgResolutionTime = Math.round(avgResolutionHours * 10) / 10

        // Penalizar si la resolución es muy lenta
        if (avgResolutionHours > 48) score -= 10 // -10 si promedio > 48h
        else if (avgResolutionHours > 24) score -= 5 // -5 si promedio > 24h
      }

      return { score: Math.max(0, Math.round(score)), details }
    } catch (error) {
      console.error('Error calculating incidents score:', error)
      return { score: 85, details: { error: error.message } }
    }
  }

  async calculateNPSScore(tenantId: string, days: number = 90): Promise<{ score: number, details: any }> {
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // Obtener surveys del período
      const { data: surveys } = await this.supabase
        .from('surveys')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', fromDate.toISOString())
        .not('score', 'is', null)

      const npseSurveys = surveys?.filter(s => s.type === 'nps') || []
      const csatSurveys = surveys?.filter(s => s.type === 'csat') || []

      let score = 70 // Score por defecto si no hay datos
      const details: any = {
        totalSurveys: surveys?.length || 0,
        npsCount: npseSurveys.length,
        csatCount: csatSurveys.length,
        npsScore: null,
        csatScore: null
      }

      // Calcular NPS (si hay datos)
      if (npseSurveys.length >= 3) {
        const promoters = npseSurveys.filter(s => s.score >= 9).length
        const detractors = npseSurveys.filter(s => s.score <= 6).length
        const npsScore = ((promoters - detractors) / npseSurveys.length) * 100
        
        details.npsScore = Math.round(npsScore)
        
        // Convertir NPS (-100 a +100) a score 0-100
        score = Math.max(0, 50 + (npsScore / 2))
      }

      // Calcular CSAT (si hay datos y no hay NPS suficiente)
      if (csatSurveys.length >= 3 && npseSurveys.length < 3) {
        const totalCsat = csatSurveys.reduce((sum, s) => sum + s.score, 0)
        const avgCsat = totalCsat / csatSurveys.length
        
        details.csatScore = Math.round(avgCsat * 10) / 10
        
        // Convertir CSAT (1-5) a score 0-100
        score = ((avgCsat - 1) / 4) * 100
      }

      // Bonificar si hay buena participación en surveys
      const totalFeedback = npseSurveys.length + csatSurveys.length
      if (totalFeedback >= 10) score += 5
      else if (totalFeedback >= 5) score += 2

      return { score: Math.min(100, Math.round(score)), details }
    } catch (error) {
      console.error('Error calculating NPS score:', error)
      return { score: 70, details: { error: error.message } }
    }
  }

  async calculateEngagementScore(tenantId: string, days: number = 30): Promise<{ score: number, details: any }> {
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // Obtener datos de engagement
      const { data: kbViews } = await this.supabase
        .from('kb_feedback')
        .select('*')
        .gte('created_at', fromDate.toISOString())

      // Mock data para otras métricas de engagement
      const mockEngagement = {
        loginDays: Math.floor(days * 0.6), // 60% de días con login
        featureAdoption: 0.7, // 70% de features usadas
        documentationViews: kbViews?.length || 5,
        supportInteractions: 2,
        apiUsage: 150
      }

      let score = 0
      const details = mockEngagement

      // Componente 1: Frecuencia de login (30%)
      const loginFrequency = mockEngagement.loginDays / days
      let loginScore = loginFrequency * 100

      // Componente 2: Adopción de features (25%)
      let featureScore = mockEngagement.featureAdoption * 100

      // Componente 3: Uso de documentación/KB (20%)
      let docsScore = 0
      if (mockEngagement.documentationViews >= 10) docsScore = 100
      else if (mockEngagement.documentationViews >= 5) docsScore = 80
      else if (mockEngagement.documentationViews >= 2) docsScore = 60
      else if (mockEngagement.documentationViews >= 1) docsScore = 40

      // Componente 4: Interacciones con soporte (15%)
      let supportScore = 100
      if (mockEngagement.supportInteractions > 3) supportScore = 60 // Muchos tickets = problema
      else if (mockEngagement.supportInteractions > 1) supportScore = 80

      // Componente 5: Uso de API (10%)
      let apiScore = 0
      if (mockEngagement.apiUsage >= 100) apiScore = 100
      else if (mockEngagement.apiUsage >= 50) apiScore = 80
      else if (mockEngagement.apiUsage >= 20) apiScore = 60
      else if (mockEngagement.apiUsage >= 5) apiScore = 40

      score = (
        loginScore * 0.3 +
        featureScore * 0.25 +
        docsScore * 0.2 +
        supportScore * 0.15 +
        apiScore * 0.1
      )

      details.breakdown = {
        login: Math.round(loginScore),
        features: Math.round(featureScore),
        documentation: Math.round(docsScore),
        support: Math.round(supportScore),
        api: Math.round(apiScore)
      }

      return { score: Math.round(score), details }
    } catch (error) {
      console.error('Error calculating engagement score:', error)
      return { score: 70, details: { error: error.message } }
    }
  }

  private async getMockSuccessMetrics(tenantId: string) {
    // Mock metrics para desarrollo
    return {
      totalExecutions: 120,
      successfulExecutions: 105,
      failedExecutions: 15,
      successRate: 0.875
    }
  }
}

// Función para determinar nivel de riesgo
function getRiskLevel(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}

// Función para generar recomendaciones
function generateRecommendations(breakdown: any, totalScore: number): string[] {
  const recommendations: string[] = []

  if (breakdown.usage < 60) {
    recommendations.push('Incrementar la frecuencia de uso de workflows para obtener más valor de la plataforma')
  }

  if (breakdown.success < 80) {
    recommendations.push('Revisar y optimizar workflows que fallan frecuentemente')
  }

  if (breakdown.incidents < 70) {
    recommendations.push('Considerar entrenamiento adicional para reducir tickets de soporte')
  }

  if (breakdown.nps < 60) {
    recommendations.push('Programar sesión de feedback para entender puntos de mejora')
  }

  if (breakdown.engagement < 70) {
    recommendations.push('Explorar nuevas funcionalidades y casos de uso de la plataforma')
  }

  if (totalScore < 60) {
    recommendations.push('Considerar agendar una sesión de Customer Success para optimizar el uso')
  }

  return recommendations
}

export const handler: Handler = async (event) => {
  // Permitir GET para scheduled functions y POST para manual
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'GET, POST',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Método no permitido' })
    }
  }

  try {
    // Validar variables de entorno
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const n8nUrl = process.env.N8N_BASE_URL
    const n8nApiKey = process.env.N8N_API_KEY
    const slackWebhook = process.env.SLACK_WEBHOOK_URL

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuración de Supabase faltante')
    }

    // Inicializar clientes
    const supabase = createClient(supabaseUrl, supabaseKey)
    const n8nClient = n8nUrl && n8nApiKey ? new N8nMetricsClient(n8nUrl, n8nApiKey) : null
    const calculator = new HealthScoreCalculator(supabase, n8nClient)

    let tenantIds: string[] = []

    // Si es POST, obtener tenant específico del body
    if (event.httpMethod === 'POST' && event.body) {
      const validatedData = healthScoreSchema.parse(JSON.parse(event.body))
      if (validatedData.tenantId) {
        tenantIds = [validatedData.tenantId]
      }
    }

    // Si no hay tenant específico, obtener todos los tenants activos
    if (tenantIds.length === 0) {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id')
        .eq('status', 'active')

      tenantIds = tenants?.map(t => t.id) || []
    }

    const results = []

    // Procesar cada tenant
    for (const tenantId of tenantIds) {
      try {
        console.log(`Calculando health score para tenant: ${tenantId}`)

        // Calcular cada componente del health score
        const [usage, success, incidents, nps, engagement] = await Promise.all([
          calculator.calculateUsageScore(tenantId),
          calculator.calculateSuccessScore(tenantId),
          calculator.calculateIncidentsScore(tenantId),
          calculator.calculateNPSScore(tenantId),
          calculator.calculateEngagementScore(tenantId)
        ])

        // Calcular score total ponderado
        const breakdown = {
          usage: usage.score,
          success: success.score,
          incidents: incidents.score,
          nps: nps.score,
          engagement: engagement.score
        }

        const totalScore = Math.round(
          breakdown.usage * defaultConfig.weights.usage +
          breakdown.success * defaultConfig.weights.success +
          breakdown.incidents * defaultConfig.weights.incidents +
          breakdown.nps * defaultConfig.weights.nps +
          breakdown.engagement * defaultConfig.weights.engagement
        )

        const riskLevel = getRiskLevel(totalScore)
        const recommendations = generateRecommendations(breakdown, totalScore)

        const healthScoreData = {
          tenant_id: tenantId,
          score: totalScore,
          breakdown: breakdown,
          risk_level: riskLevel,
          factors: {
            usage: usage.details,
            success: success.details,
            incidents: incidents.details,
            nps: nps.details,
            engagement: engagement.details
          },
          recommendations,
          calculated_by: 'scheduled_function',
          notes: `Calculated using weights: ${JSON.stringify(defaultConfig.weights)}`
        }

        // Guardar en BD
        const { data: savedScore, error } = await supabase
          .from('cs_health_scores')
          .insert(healthScoreData)
          .select()
          .single()

        if (error) {
          throw new Error(`Error guardando health score: ${error.message}`)
        }

        // Enviar alerta si el score es bajo
        if (totalScore < 60 && slackWebhook) {
          await sendLowScoreAlert(slackWebhook, tenantId, totalScore, riskLevel, recommendations)
        }

        results.push({
          tenantId,
          score: totalScore,
          riskLevel,
          breakdown,
          saved: true
        })

        console.log(`Health score calculado para ${tenantId}: ${totalScore} (${riskLevel})`)

      } catch (tenantError: any) {
        console.error(`Error calculando health score para tenant ${tenantId}:`, tenantError)
        results.push({
          tenantId,
          error: tenantError.message,
          saved: false
        })
      }
    }

    // Log del resumen
    const successCount = results.filter(r => r.saved).length
    const errorCount = results.filter(r => !r.saved).length
    
    console.log(`Health scores procesados: ${successCount} exitosos, ${errorCount} errores`)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        processed: results.length,
        successful: successCount,
        errors: errorCount,
        results: results
      })
    }

  } catch (error: any) {
    console.error('Error in cs-healthscore function:', error)

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: false,
        error: 'Error calculando health scores',
        message: error.message
      })
    }
  }
}

// Función para enviar alerta de score bajo
async function sendLowScoreAlert(webhook: string, tenantId: string, score: number, riskLevel: string, recommendations: string[]) {
  try {
    const message = {
      text: `🚨 Health Score Bajo Detectado`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Health Score Bajo: ${score}/100`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Tenant:* ${tenantId}`
            },
            {
              type: 'mrkdwn',
              text: `*Nivel de Riesgo:* ${riskLevel === 'red' ? '🔴 Alto' : '🟡 Medio'}`
            },
            {
              type: 'mrkdwn',
              text: `*Score:* ${score}/100`
            },
            {
              type: 'mrkdwn',
              text: `*Fecha:* ${new Date().toLocaleDateString('es-MX')}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Recomendaciones:*\n${recommendations.map(r => `• ${r}`).join('\n')}`
          }
        }
      ]
    }

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
  } catch (error) {
    console.error('Error sending Slack alert:', error)
  }
}