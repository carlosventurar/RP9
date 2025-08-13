import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock functions para QBR scheduler
const getQuarterStartDate = (quarter: string): string => {
  const [year, q] = quarter.split('-Q')
  const quarterNum = parseInt(q)
  const month = (quarterNum - 1) * 3 + 1 // Q1=1, Q2=4, Q3=7, Q4=10
  return new Date(parseInt(year), month - 1, 1).toISOString()
}

const getQuarterEndDate = (quarter: string): string => {
  const [year, q] = quarter.split('-Q')
  const quarterNum = parseInt(q)
  const month = quarterNum * 3 // Q1=3, Q2=6, Q3=9, Q4=12
  const lastDay = new Date(parseInt(year), month, 0).getDate()
  return new Date(parseInt(year), month - 1, lastDay, 23, 59, 59).toISOString()
}

const calculateQBRPriority = (tenant: any, healthScore: any): 'high' | 'medium' | 'low' => {
  if (tenant.plan === 'enterprise') return 'high'
  if (healthScore && healthScore.score < 60) return 'high'
  if (tenant.plan === 'pro') return 'medium'
  return 'low'
}

const generateDefaultScheduleDate = (quarter: string, priority: string): string => {
  const quarterStart = new Date(getQuarterStartDate(quarter))
  
  let targetWeek: number
  switch (priority) {
    case 'high':
      targetWeek = 10 // Semana 10 del quarter
      break
    case 'medium':
      targetWeek = 11 // Semana 11 del quarter
      break
    case 'low':
      targetWeek = 12 // Semana 12 del quarter
      break
    default:
      targetWeek = 11
  }
  
  const targetDate = new Date(quarterStart)
  targetDate.setDate(targetDate.getDate() + (targetWeek * 7))
  
  // Mover a próximo martes si cae en fin de semana
  while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
    targetDate.setDate(targetDate.getDate() + 1)
  }
  
  return targetDate.toISOString()
}

const generateQBRAgenda = (tenant: any, healthScore: any, tickets: any[] = []) => {
  return {
    quarterSummary: {
      healthScore: healthScore?.score || 'N/A',
      totalTickets: tickets.length,
      criticalTickets: tickets.filter(t => t.severity === 'P1').length,
      plan: tenant.plan
    },
    discussionTopics: [
      'Revisión de Health Score y métricas clave',
      'Análisis de tickets y resolución de issues',
      'Adopción de nuevas funcionalidades',
      'Roadmap y próximas releases',
      'Objetivos para el próximo quarter'
    ],
    preparationItems: [
      'Revisar métricas de uso del quarter',
      'Preparar casos de uso exitosos',
      'Identificar pain points y mejoras',
      'Definir KPIs para próximo quarter'
    ]
  }
}

const validateQBRData = (qbrData: any) => {
  const errors = []

  if (!qbrData.tenantId) {
    errors.push('Tenant ID is required')
  }

  if (!qbrData.quarter || !/^\d{4}-Q[1-4]$/.test(qbrData.quarter)) {
    errors.push('Valid quarter format required (YYYY-Qn)')
  }

  if (qbrData.priority && !['high', 'medium', 'low'].includes(qbrData.priority)) {
    errors.push('Priority must be high, medium, or low')
  }

  if (qbrData.scheduledDate) {
    const date = new Date(qbrData.scheduledDate)
    if (isNaN(date.getTime())) {
      errors.push('Invalid scheduled date')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

describe('QBR Scheduler', () => {
  describe('Quarter Date Calculations', () => {
    it('debería calcular fechas de inicio de quarter correctamente', () => {
      expect(getQuarterStartDate('2024-Q1')).toBe(new Date(2024, 0, 1).toISOString()) // Enero 1
      expect(getQuarterStartDate('2024-Q2')).toBe(new Date(2024, 3, 1).toISOString()) // Abril 1
      expect(getQuarterStartDate('2024-Q3')).toBe(new Date(2024, 6, 1).toISOString()) // Julio 1
      expect(getQuarterStartDate('2024-Q4')).toBe(new Date(2024, 9, 1).toISOString()) // Octubre 1
    })

    it('debería calcular fechas de fin de quarter correctamente', () => {
      expect(getQuarterEndDate('2024-Q1')).toBe(new Date(2024, 2, 31, 23, 59, 59).toISOString()) // Marzo 31
      expect(getQuarterEndDate('2024-Q2')).toBe(new Date(2024, 5, 30, 23, 59, 59).toISOString()) // Junio 30
      expect(getQuarterEndDate('2024-Q3')).toBe(new Date(2024, 8, 30, 23, 59, 59).toISOString()) // Septiembre 30
      expect(getQuarterEndDate('2024-Q4')).toBe(new Date(2024, 11, 31, 23, 59, 59).toISOString()) // Diciembre 31
    })
  })

  describe('Priority Calculation', () => {
    it('debería asignar alta prioridad a clientes enterprise', () => {
      const tenant = { plan: 'enterprise', name: 'Big Corp' }
      const healthScore = { score: 85 }
      
      expect(calculateQBRPriority(tenant, healthScore)).toBe('high')
    })

    it('debería asignar alta prioridad a health score bajo', () => {
      const tenant = { plan: 'pro', name: 'Medium Corp' }
      const healthScore = { score: 45 }
      
      expect(calculateQBRPriority(tenant, healthScore)).toBe('high')
    })

    it('debería asignar prioridad media a clientes pro', () => {
      const tenant = { plan: 'pro', name: 'Medium Corp' }
      const healthScore = { score: 75 }
      
      expect(calculateQBRPriority(tenant, healthScore)).toBe('medium')
    })

    it('debería asignar prioridad baja a clientes starter', () => {
      const tenant = { plan: 'starter', name: 'Small Corp' }
      const healthScore = { score: 80 }
      
      expect(calculateQBRPriority(tenant, healthScore)).toBe('low')
    })
  })

  describe('Schedule Date Generation', () => {
    it('debería programar QBRs de alta prioridad temprano en el quarter', () => {
      const quarter = '2024-Q4'
      const date = new Date(generateDefaultScheduleDate(quarter, 'high'))
      const quarterStart = new Date(getQuarterStartDate(quarter))
      
      const weeksDiff = (date.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24 * 7)
      expect(weeksDiff).toBeCloseTo(10, 0) // Aproximadamente semana 10
    })

    it('debería evitar fines de semana en fechas programadas', () => {
      const date = new Date(generateDefaultScheduleDate('2024-Q4', 'medium'))
      const dayOfWeek = date.getDay()
      
      expect(dayOfWeek).not.toBe(0) // No domingo
      expect(dayOfWeek).not.toBe(6) // No sábado
    })

    it('debería programar diferentes prioridades en diferentes semanas', () => {
      const quarter = '2024-Q4'
      const highDate = new Date(generateDefaultScheduleDate(quarter, 'high'))
      const mediumDate = new Date(generateDefaultScheduleDate(quarter, 'medium'))
      const lowDate = new Date(generateDefaultScheduleDate(quarter, 'low'))
      
      expect(highDate.getTime()).toBeLessThan(mediumDate.getTime())
      expect(mediumDate.getTime()).toBeLessThan(lowDate.getTime())
    })
  })

  describe('Agenda Generation', () => {
    it('debería generar agenda con resumen del quarter', () => {
      const tenant = { plan: 'pro', name: 'Test Corp' }
      const healthScore = { score: 78 }
      const tickets = [
        { severity: 'P1' },
        { severity: 'P2' },
        { severity: 'P3' }
      ]

      const agenda = generateQBRAgenda(tenant, healthScore, tickets)

      expect(agenda.quarterSummary.healthScore).toBe(78)
      expect(agenda.quarterSummary.totalTickets).toBe(3)
      expect(agenda.quarterSummary.criticalTickets).toBe(1)
      expect(agenda.quarterSummary.plan).toBe('pro')
    })

    it('debería incluir temas de discusión estándar', () => {
      const tenant = { plan: 'enterprise', name: 'Big Corp' }
      const agenda = generateQBRAgenda(tenant, null)

      expect(agenda.discussionTopics).toContain('Revisión de Health Score y métricas clave')
      expect(agenda.discussionTopics).toContain('Roadmap y próximas releases')
      expect(agenda.discussionTopics.length).toBeGreaterThan(3)
    })

    it('debería incluir items de preparación', () => {
      const tenant = { plan: 'starter', name: 'Small Corp' }
      const agenda = generateQBRAgenda(tenant, null)

      expect(agenda.preparationItems).toContain('Revisar métricas de uso del quarter')
      expect(agenda.preparationItems).toContain('Definir KPIs para próximo quarter')
    })
  })

  describe('Data Validation', () => {
    it('debería validar datos de QBR correctos', () => {
      const validData = {
        tenantId: 'tenant-123',
        quarter: '2024-Q4',
        priority: 'high',
        scheduledDate: '2024-12-15T10:00:00Z'
      }

      const validation = validateQBRData(validData)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('debería rechazar tenant ID faltante', () => {
      const invalidData = {
        quarter: '2024-Q4',
        priority: 'high'
      }

      const validation = validateQBRData(invalidData)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Tenant ID is required')
    })

    it('debería rechazar formato de quarter inválido', () => {
      const invalidData = {
        tenantId: 'tenant-123',
        quarter: '2024-Q5', // Q5 no existe
        priority: 'high'
      }

      const validation = validateQBRData(invalidData)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Valid quarter format required (YYYY-Qn)')
    })

    it('debería rechazar prioridad inválida', () => {
      const invalidData = {
        tenantId: 'tenant-123',
        quarter: '2024-Q4',
        priority: 'urgent' // No es high/medium/low
      }

      const validation = validateQBRData(invalidData)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Priority must be high, medium, or low')
    })

    it('debería rechazar fecha inválida', () => {
      const invalidData = {
        tenantId: 'tenant-123',
        quarter: '2024-Q4',
        scheduledDate: 'invalid-date'
      }

      const validation = validateQBRData(invalidData)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Invalid scheduled date')
    })
  })

  describe('Auto-scheduling Logic', () => {
    it('debería identificar tenants elegibles para QBR', () => {
      const tenants = [
        { id: '1', plan: 'enterprise', created_at: '2024-01-01', status: 'active' },
        { id: '2', plan: 'pro', created_at: '2024-06-01', status: 'active' },
        { id: '3', plan: 'starter', created_at: '2024-11-01', status: 'active' }, // Muy nuevo
        { id: '4', plan: 'pro', created_at: '2024-03-01', status: 'cancelled' } // Cancelado
      ]

      const isEligibleForQBR = (tenant: any) => {
        if (tenant.status !== 'active') return false
        if (!['pro', 'enterprise'].includes(tenant.plan)) return false
        
        // Al menos 3 meses activo
        const accountAge = Date.now() - new Date(tenant.created_at).getTime()
        const threeMonths = 90 * 24 * 60 * 60 * 1000
        
        return accountAge >= threeMonths
      }

      const eligible = tenants.filter(isEligibleForQBR)
      
      expect(eligible).toHaveLength(2)
      expect(eligible.map(t => t.id)).toEqual(['1', '2'])
    })
  })

  describe('Status Updates', () => {
    it('debería permitir transiciones de estado válidas', () => {
      const validTransitions = {
        scheduled: ['completed', 'cancelled', 'rescheduled'],
        rescheduled: ['completed', 'cancelled', 'scheduled'],
        completed: [], // Estado final
        cancelled: ['scheduled'] // Puede reprogramar
      }

      const isValidTransition = (from: string, to: string) => {
        return validTransitions[from as keyof typeof validTransitions]?.includes(to) || false
      }

      expect(isValidTransition('scheduled', 'completed')).toBe(true)
      expect(isValidTransition('scheduled', 'cancelled')).toBe(true)
      expect(isValidTransition('completed', 'cancelled')).toBe(false)
      expect(isValidTransition('cancelled', 'scheduled')).toBe(true)
    })
  })
})