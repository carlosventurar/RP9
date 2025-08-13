import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock functions para feature requests
const detectSpam = (title: string, description: string): boolean => {
  const spamKeywords = [
    'free money', 'click here', 'urgent', 'act now', 'limited time',
    'make money fast', 'work from home', 'no cost', 'risk free'
  ]
  
  const content = (title + ' ' + description).toLowerCase()
  
  // Check for spam keywords
  const hasSpamKeywords = spamKeywords.some(keyword => content.includes(keyword))
  
  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length
  const excessiveCaps = capsRatio > 0.5
  
  // Check for repeated characters
  const hasRepeatedChars = /(.)\1{4,}/.test(content)
  
  return hasSpamKeywords || excessiveCaps || hasRepeatedChars
}

const validateFeatureRequest = (data: any) => {
  const errors = []

  if (!data.title || data.title.length < 5 || data.title.length > 200) {
    errors.push('Title must be between 5 and 200 characters')
  }

  if (!data.description || data.description.length < 10 || data.description.length > 2000) {
    errors.push('Description must be between 10 and 2000 characters')
  }

  const validCategories = ['integration', 'workflow', 'ui_ux', 'performance', 'security', 'api', 'mobile', 'other']
  if (!data.category || !validCategories.includes(data.category)) {
    errors.push('Valid category is required')
  }

  const validPriorities = ['low', 'medium', 'high']
  if (data.priority && !validPriorities.includes(data.priority)) {
    errors.push('Priority must be low, medium, or high')
  }

  if (data.userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.userEmail)) {
    errors.push('Valid email address required')
  }

  if (data.tags && (!Array.isArray(data.tags) || data.tags.length > 10)) {
    errors.push('Tags must be an array with maximum 10 items')
  }

  if (data.businessJustification && data.businessJustification.length > 1000) {
    errors.push('Business justification must be under 1000 characters')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

const calculateVoteScore = (upVotes: number, downVotes: number): number => {
  const totalVotes = upVotes + downVotes
  if (totalVotes === 0) return 0
  
  // Score Wilson que considera tanto la proporción como la cantidad total
  const positiveRate = upVotes / totalVotes
  const confidence = 0.95 // 95% confidence level
  const z = 1.96 // Z-score for 95% confidence
  
  const wilson = (positiveRate + z * z / (2 * totalVotes) - z * Math.sqrt((positiveRate * (1 - positiveRate) + z * z / (4 * totalVotes)) / totalVotes)) / (1 + z * z / totalVotes)
  
  return Math.round(wilson * 100)
}

const prioritizeRequests = (requests: any[]): any[] => {
  return requests.sort((a, b) => {
    // Primero por estado (open > under_review > planned > etc.)
    const statusPriority = {
      'open': 4,
      'under_review': 3,
      'planned': 2,
      'in_progress': 1,
      'completed': 0,
      'declined': 0
    }

    const statusDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0)
    if (statusDiff !== 0) return statusDiff

    // Luego por votos
    const voteDiff = (b.vote_count || 0) - (a.vote_count || 0)
    if (voteDiff !== 0) return voteDiff

    // Finalmente por fecha de creación (más reciente primero)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

const generateFeatureRequestId = (): string => {
  return 'fr_' + Math.random().toString(36).substr(2, 9)
}

const calculateRequestMetrics = (requests: any[]) => {
  const total = requests.length
  const byStatus = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1
    return acc
  }, {})
  
  const byCategory = requests.reduce((acc, req) => {
    acc[req.category] = (acc[req.category] || 0) + 1
    return acc
  }, {})

  const totalVotes = requests.reduce((sum, req) => sum + (req.vote_count || 0), 0)
  const averageVotes = total > 0 ? totalVotes / total : 0

  const completionRate = total > 0 ? (byStatus.completed || 0) / total * 100 : 0

  return {
    total,
    byStatus,
    byCategory,
    totalVotes,
    averageVotes: Math.round(averageVotes * 10) / 10,
    completionRate: Math.round(completionRate)
  }
}

describe('Feature Requests System', () => {
  describe('Validation', () => {
    it('debería validar feature request válido', () => {
      const validRequest = {
        title: 'Integración con Zapier',
        description: 'Necesitamos una integración nativa con Zapier para conectar con más de 5000 aplicaciones',
        category: 'integration',
        priority: 'high',
        userEmail: 'user@example.com',
        tags: ['zapier', 'integration', 'automation'],
        businessJustification: 'Esto nos permitiría expandir significativamente nuestras opciones de integración'
      }

      const validation = validateFeatureRequest(validRequest)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('debería rechazar título muy corto', () => {
      const invalidRequest = {
        title: 'API',
        description: 'Necesitamos una mejor API',
        category: 'api'
      }

      const validation = validateFeatureRequest(invalidRequest)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Title must be between 5 and 200 characters')
    })

    it('debería rechazar descripción muy corta', () => {
      const invalidRequest = {
        title: 'Nueva integración',
        description: 'Por favor',
        category: 'integration'
      }

      const validation = validateFeatureRequest(invalidRequest)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Description must be between 10 and 2000 characters')
    })

    it('debería rechazar categoría inválida', () => {
      const invalidRequest = {
        title: 'Nueva funcionalidad',
        description: 'Descripción válida de la nueva funcionalidad que necesitamos',
        category: 'invalid_category'
      }

      const validation = validateFeatureRequest(invalidRequest)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Valid category is required')
    })

    it('debería rechazar email inválido', () => {
      const invalidRequest = {
        title: 'Nueva integración',
        description: 'Descripción válida de la nueva integración que necesitamos',
        category: 'integration',
        userEmail: 'invalid-email'
      }

      const validation = validateFeatureRequest(invalidRequest)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Valid email address required')
    })

    it('debería rechazar demasiados tags', () => {
      const invalidRequest = {
        title: 'Nueva funcionalidad',
        description: 'Descripción válida de la nueva funcionalidad que necesitamos',
        category: 'other',
        tags: new Array(15).fill('tag') // 15 tags, máximo 10
      }

      const validation = validateFeatureRequest(invalidRequest)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Tags must be an array with maximum 10 items')
    })
  })

  describe('Spam Detection', () => {
    it('debería detectar spam por keywords', () => {
      const spamTitle = 'FREE MONEY NOW!'
      const spamDescription = 'Click here for free money! Act now! Limited time offer!'

      expect(detectSpam(spamTitle, spamDescription)).toBe(true)
    })

    it('debería detectar spam por exceso de mayúsculas', () => {
      const title = 'URGENT FEATURE REQUEST'
      const description = 'THIS IS VERY IMPORTANT AND URGENT PLEASE IMPLEMENT IMMEDIATELY'

      expect(detectSpam(title, description)).toBe(true)
    })

    it('debería detectar spam por caracteres repetidos', () => {
      const title = 'Pleeeeeease implement this'
      const description = 'We really need thissssss feature'

      expect(detectSpam(title, description)).toBe(true)
    })

    it('debería permitir contenido legítimo', () => {
      const title = 'Slack Integration Request'
      const description = 'We need a native Slack integration to improve our team communication workflow'

      expect(detectSpam(title, description)).toBe(false)
    })
  })

  describe('Voting System', () => {
    it('debería calcular vote score correctamente', () => {
      expect(calculateVoteScore(10, 0)).toBeGreaterThan(80) // Todos positivos
      expect(calculateVoteScore(5, 5)).toBe(50) // 50/50
      expect(calculateVoteScore(0, 10)).toBeLessThan(20) // Todos negativos
      expect(calculateVoteScore(0, 0)).toBe(0) // Sin votos
    })

    it('debería considerar volumen de votos en el score', () => {
      const highVolumeScore = calculateVoteScore(100, 10) // 90% positivo, alto volumen
      const lowVolumeScore = calculateVoteScore(9, 1) // 90% positivo, bajo volumen
      
      expect(highVolumeScore).toBeGreaterThan(lowVolumeScore)
    })
  })

  describe('Request Prioritization', () => {
    it('debería priorizar por estado primero', () => {
      const requests = [
        { id: '1', status: 'completed', vote_count: 100, created_at: '2024-01-01' },
        { id: '2', status: 'open', vote_count: 5, created_at: '2024-01-02' },
        { id: '3', status: 'planned', vote_count: 50, created_at: '2024-01-03' }
      ]

      const prioritized = prioritizeRequests([...requests])
      
      expect(prioritized[0].id).toBe('2') // open
      expect(prioritized[1].id).toBe('3') // planned
      expect(prioritized[2].id).toBe('1') // completed
    })

    it('debería priorizar por votos cuando el estado es igual', () => {
      const requests = [
        { id: '1', status: 'open', vote_count: 10, created_at: '2024-01-01' },
        { id: '2', status: 'open', vote_count: 50, created_at: '2024-01-02' },
        { id: '3', status: 'open', vote_count: 25, created_at: '2024-01-03' }
      ]

      const prioritized = prioritizeRequests([...requests])
      
      expect(prioritized[0].vote_count).toBe(50)
      expect(prioritized[1].vote_count).toBe(25)
      expect(prioritized[2].vote_count).toBe(10)
    })
  })

  describe('Analytics', () => {
    it('debería calcular métricas correctamente', () => {
      const requests = [
        { status: 'open', category: 'integration', vote_count: 10 },
        { status: 'completed', category: 'integration', vote_count: 15 },
        { status: 'open', category: 'api', vote_count: 5 },
        { status: 'declined', category: 'ui_ux', vote_count: 2 }
      ]

      const metrics = calculateRequestMetrics(requests)

      expect(metrics.total).toBe(4)
      expect(metrics.byStatus.open).toBe(2)
      expect(metrics.byStatus.completed).toBe(1)
      expect(metrics.byCategory.integration).toBe(2)
      expect(metrics.totalVotes).toBe(32)
      expect(metrics.averageVotes).toBe(8)
      expect(metrics.completionRate).toBe(25) // 1/4 * 100
    })

    it('debería manejar lista vacía', () => {
      const metrics = calculateRequestMetrics([])

      expect(metrics.total).toBe(0)
      expect(metrics.totalVotes).toBe(0)
      expect(metrics.averageVotes).toBe(0)
      expect(metrics.completionRate).toBe(0)
    })
  })

  describe('ID Generation', () => {
    it('debería generar IDs únicos', () => {
      const ids = new Set()
      
      for (let i = 0; i < 1000; i++) {
        const id = generateFeatureRequestId()
        expect(id).toMatch(/^fr_[a-z0-9]{9}$/)
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }
    })
  })

  describe('Business Logic', () => {
    it('debería permitir múltiples votos del mismo usuario en diferentes requests', () => {
      const canVote = (userId: string, requestId: string, existingVotes: any[]) => {
        return !existingVotes.some(vote => 
          vote.user_id === userId && vote.request_id === requestId
        )
      }

      const existingVotes = [
        { user_id: 'user1', request_id: 'req1' },
        { user_id: 'user1', request_id: 'req2' }
      ]

      expect(canVote('user1', 'req1', existingVotes)).toBe(false) // Ya votó
      expect(canVote('user1', 'req3', existingVotes)).toBe(true) // Nuevo request
      expect(canVote('user2', 'req1', existingVotes)).toBe(true) // Nuevo usuario
    })

    it('debería permitir cambiar voto existente', () => {
      const updateVote = (userId: string, requestId: string, newVoteType: string, existingVotes: any[]) => {
        const existingVote = existingVotes.find(vote => 
          vote.user_id === userId && vote.request_id === requestId
        )

        if (existingVote) {
          existingVote.vote_type = newVoteType
          return { updated: true, previousVote: existingVote.vote_type }
        }

        return { updated: false }
      }

      const votes = [
        { user_id: 'user1', request_id: 'req1', vote_type: 'up' }
      ]

      const result = updateVote('user1', 'req1', 'down', votes)
      expect(result.updated).toBe(true)
      expect(votes[0].vote_type).toBe('down')
    })

    it('debería calcular trending requests', () => {
      const calculateTrending = (requests: any[], timeWindow: number = 7) => {
        const cutoffDate = new Date(Date.now() - timeWindow * 24 * 60 * 60 * 1000)
        
        return requests
          .filter(req => new Date(req.created_at) > cutoffDate)
          .sort((a, b) => {
            const aVelocity = a.vote_count / Math.max(1, (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
            const bVelocity = b.vote_count / Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24))
            return bVelocity - aVelocity
          })
      }

      const requests = [
        { id: '1', vote_count: 20, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }, // 2 días, 10 votos/día
        { id: '2', vote_count: 50, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }, // 10 días, 5 votos/día
        { id: '3', vote_count: 15, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() } // 1 día, 15 votos/día
      ]

      const trending = calculateTrending(requests)
      expect(trending[0].id).toBe('3') // Mayor velocidad
      expect(trending[1].id).toBe('1') // Segunda mayor velocidad
    })
  })
})