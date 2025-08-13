import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de health score calculator
const calculateHealthScore = (metrics: {
  usage: number
  success: number
  incidents: number
  nps: number
  engagement: number
}) => {
  const weights = {
    usage: 0.30,
    success: 0.25,
    incidents: 0.20,
    nps: 0.15,
    engagement: 0.10
  }

  const score = Math.round(
    metrics.usage * weights.usage +
    metrics.success * weights.success +
    metrics.incidents * weights.incidents +
    metrics.nps * weights.nps +
    metrics.engagement * weights.engagement
  )

  return Math.max(0, Math.min(100, score))
}

const calculateRiskLevel = (score: number): 'green' | 'yellow' | 'red' => {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}

const calculateUsageScore = (metrics: {
  totalExecutions: number
  activeWorkflows: number
  avgExecutionTime: number
  lastExecution: Date
}) => {
  let score = 0

  // Frecuencia de uso (40%)
  const dailyExecutions = metrics.totalExecutions / 30 // Asumiendo métricas de 30 días
  if (dailyExecutions >= 10) score += 40
  else if (dailyExecutions >= 5) score += 30
  else if (dailyExecutions >= 1) score += 20
  else score += 10

  // Actividad reciente (30%)
  const daysSinceLastExecution = (Date.now() - metrics.lastExecution.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLastExecution <= 1) score += 30
  else if (daysSinceLastExecution <= 3) score += 25
  else if (daysSinceLastExecution <= 7) score += 15
  else score += 5

  // Diversidad workflows (20%)
  if (metrics.activeWorkflows >= 5) score += 20
  else if (metrics.activeWorkflows >= 3) score += 15
  else if (metrics.activeWorkflows >= 1) score += 10
  else score += 0

  // Performance (10%)
  if (metrics.avgExecutionTime < 2000) score += 10
  else if (metrics.avgExecutionTime < 5000) score += 8
  else if (metrics.avgExecutionTime < 10000) score += 5
  else score += 2

  return Math.min(100, score)
}

const calculateIncidentsScore = (metrics: {
  totalTickets: number
  criticalTickets: number
  avgResolutionTime: number
}) => {
  let score = 100 // Empezar con score perfecto

  // Penalizar tickets críticos
  score -= metrics.criticalTickets * 20

  // Penalizar tickets en general
  score -= metrics.totalTickets * 5

  // Penalizar tiempo de resolución lento
  if (metrics.avgResolutionTime > 48) {
    score -= 15
  } else if (metrics.avgResolutionTime > 24) {
    score -= 10
  }

  return Math.max(0, score)
}

describe('Health Score Calculator', () => {
  it('debería calcular health score correctamente con métricas balanceadas', () => {
    const metrics = {
      usage: 85,
      success: 90,
      incidents: 80,
      nps: 75,
      engagement: 70
    }

    const score = calculateHealthScore(metrics)
    expect(score).toBe(82) // 85*0.3 + 90*0.25 + 80*0.2 + 75*0.15 + 70*0.1
  })

  it('debería limitar el score entre 0 y 100', () => {
    const highMetrics = {
      usage: 120,
      success: 110,
      incidents: 95,
      nps: 100,
      engagement: 90
    }

    const lowMetrics = {
      usage: -10,
      success: 0,
      incidents: -5,
      nps: 10,
      engagement: 5
    }

    expect(calculateHealthScore(highMetrics)).toBeLessThanOrEqual(100)
    expect(calculateHealthScore(lowMetrics)).toBeGreaterThanOrEqual(0)
  })

  it('debería calcular el nivel de riesgo correctamente', () => {
    expect(calculateRiskLevel(85)).toBe('green')
    expect(calculateRiskLevel(80)).toBe('green')
    expect(calculateRiskLevel(75)).toBe('yellow')
    expect(calculateRiskLevel(60)).toBe('yellow')
    expect(calculateRiskLevel(45)).toBe('red')
    expect(calculateRiskLevel(0)).toBe('red')
  })

  it('debería calcular usage score correctamente', () => {
    const goodUsage = {
      totalExecutions: 300, // 10 por día
      activeWorkflows: 5,
      avgExecutionTime: 1500, // 1.5 segundos
      lastExecution: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 horas atrás
    }

    const score = calculateUsageScore(goodUsage)
    expect(score).toBe(100) // 40 + 30 + 20 + 10

    const poorUsage = {
      totalExecutions: 15, // 0.5 por día
      activeWorkflows: 1,
      avgExecutionTime: 15000, // 15 segundos
      lastExecution: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 días atrás
    }

    const poorScore = calculateUsageScore(poorUsage)
    expect(poorScore).toBe(27) // 10 + 5 + 10 + 2
  })

  it('debería calcular incidents score correctamente', () => {
    // Sin incidentes
    const noIncidents = {
      totalTickets: 0,
      criticalTickets: 0,
      avgResolutionTime: 12
    }
    expect(calculateIncidentsScore(noIncidents)).toBe(100)

    // Con algunos tickets pero sin críticos
    const someTickets = {
      totalTickets: 3,
      criticalTickets: 0,
      avgResolutionTime: 18
    }
    expect(calculateIncidentsScore(someTickets)).toBe(85) // 100 - 3*5

    // Con tickets críticos
    const criticalIssues = {
      totalTickets: 5,
      criticalTickets: 2,
      avgResolutionTime: 60
    }
    expect(calculateIncidentsScore(criticalIssues)).toBe(45) // 100 - 2*20 - 5*5 - 15
  })

  it('debería manejar valores edge case', () => {
    const edgeCase = {
      usage: 0,
      success: 0,
      incidents: 0,
      nps: 0,
      engagement: 0
    }

    const score = calculateHealthScore(edgeCase)
    expect(score).toBe(0)
  })

  it('debería validar que los pesos suman 1.0', () => {
    const weights = {
      usage: 0.30,
      success: 0.25,
      incidents: 0.20,
      nps: 0.15,
      engagement: 0.10
    }

    const sum = Object.values(weights).reduce((acc, weight) => acc + weight, 0)
    expect(sum).toBeCloseTo(1.0, 2)
  })

  it('debería generar recomendaciones basadas en scores bajos', () => {
    const generateRecommendations = (breakdown: any) => {
      const recommendations = []

      if (breakdown.usage < 60) {
        recommendations.push('Incrementar frecuencia de uso de workflows')
      }

      if (breakdown.success < 70) {
        recommendations.push('Revisar y optimizar workflows con errores frecuentes')
      }

      if (breakdown.incidents < 80) {
        recommendations.push('Resolver tickets pendientes para mejorar score de incidentes')
      }

      if (breakdown.nps < 70) {
        recommendations.push('Mejorar satisfacción del cliente con encuestas NPS')
      }

      if (breakdown.engagement < 60) {
        recommendations.push('Aumentar adopción de features avanzadas')
      }

      return recommendations
    }

    const lowScores = {
      usage: 45,
      success: 65,
      incidents: 75,
      nps: 50,
      engagement: 55
    }

    const recommendations = generateRecommendations(lowScores)
    expect(recommendations).toHaveLength(4)
    expect(recommendations).toContain('Incrementar frecuencia de uso de workflows')
    expect(recommendations).toContain('Mejorar satisfacción del cliente con encuestas NPS')
  })

  it('debería calcular tendencia de health score', () => {
    const calculateTrend = (scores: number[]) => {
      if (scores.length < 2) return 'stable'
      
      const recent = scores.slice(-3) // Últimos 3 scores
      const average = recent.reduce((a, b) => a + b, 0) / recent.length
      const previous = scores[scores.length - 2]
      const current = scores[scores.length - 1]
      
      const shortTermChange = current - previous
      
      if (shortTermChange > 5) return 'improving'
      if (shortTermChange < -5) return 'declining'
      return 'stable'
    }

    expect(calculateTrend([70, 75, 80, 85])).toBe('improving')
    expect(calculateTrend([85, 80, 75, 70])).toBe('declining')
    expect(calculateTrend([75, 77, 76, 78])).toBe('stable')
  })
})