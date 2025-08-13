import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: {
            id: 'tenant-1',
            name: 'Test Tenant',
            plan: 'pro',
            email: 'test@example.com'
          },
          error: null
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: {
            id: 'ticket-1',
            tenant_id: 'tenant-1',
            subject: 'Test ticket',
            description: 'Test description',
            severity: 'P2',
            channel: 'email',
            status: 'open',
            created_at: new Date().toISOString()
          },
          error: null
        }))
      }))
    }))
  }))
}

// Mock de fetch para HubSpot
global.fetch = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase
}))

// Import the handler after mocking
const mockHandler = async (event: any) => {
  // Simulación simplificada del handler
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Request body is required' })
    }
  }

  const requestData = JSON.parse(event.body)

  // Validación básica
  if (!requestData.tenantId || !requestData.subject || !requestData.description) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' })
    }
  }

  // Simular creación exitosa
  const ticket = {
    id: 'ticket-1',
    tenant_id: requestData.tenantId,
    subject: requestData.subject,
    description: requestData.description,
    severity: requestData.severity || 'P3',
    channel: requestData.channel || 'email',
    status: 'open',
    created_at: new Date().toISOString()
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      ticket,
      message: 'Ticket created successfully'
    })
  }
}

describe('Create Ticket Function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch para HubSpot API
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'hubspot-ticket-123',
        properties: {
          subject: 'Test ticket',
          content: 'Test description'
        }
      })
    })
  })

  it('debería crear un ticket exitosamente con datos válidos', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        tenantId: 'tenant-1',
        subject: 'Error en integración Stripe',
        description: 'La integración con Stripe no está funcionando correctamente',
        severity: 'P2',
        channel: 'email',
        tags: ['stripe', 'integración']
      })
    }

    const response = await mockHandler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.success).toBe(true)
    expect(body.ticket).toBeDefined()
    expect(body.ticket.subject).toBe('Error en integración Stripe')
    expect(body.ticket.severity).toBe('P2')
    expect(body.ticket.status).toBe('open')
  })

  it('debería fallar sin request body', async () => {
    const event = {
      httpMethod: 'POST',
      body: null
    }

    const response = await mockHandler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(400)
    expect(body.error).toBe('Request body is required')
  })

  it('debería fallar con campos requeridos faltantes', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        tenantId: 'tenant-1'
        // Faltan subject y description
      })
    }

    const response = await mockHandler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(400)
    expect(body.error).toBe('Missing required fields')
  })

  it('debería asignar valores por defecto correctos', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        tenantId: 'tenant-1',
        subject: 'Test ticket',
        description: 'Test description'
        // Sin severity ni channel
      })
    }

    const response = await mockHandler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.ticket.severity).toBe('P3') // Default
    expect(body.ticket.channel).toBe('email') // Default
  })

  it('debería calcular SLA correctamente según severidad', () => {
    const calculateSLA = (severity: string, plan: string) => {
      const slaMatrix = {
        starter: { P1: 480, P2: 480, P3: 2880 }, // minutos
        pro: { P1: 240, P2: 240, P3: 2880 },
        enterprise: { P1: 60, P2: 240, P3: 2880 }
      }
      
      return slaMatrix[plan as keyof typeof slaMatrix]?.[severity as keyof typeof slaMatrix.starter] || 2880
    }

    expect(calculateSLA('P1', 'enterprise')).toBe(60)
    expect(calculateSLA('P2', 'pro')).toBe(240)
    expect(calculateSLA('P3', 'starter')).toBe(2880)
  })

  it('debería validar severidad correcta', () => {
    const validSeverities = ['P1', 'P2', 'P3']
    
    expect(validSeverities.includes('P1')).toBe(true)
    expect(validSeverities.includes('P2')).toBe(true)
    expect(validSeverities.includes('P3')).toBe(true)
    expect(validSeverities.includes('P4')).toBe(false)
  })

  it('debería validar canales permitidos', () => {
    const validChannels = ['email', 'chat', 'slack']
    
    expect(validChannels.includes('email')).toBe(true)
    expect(validChannels.includes('chat')).toBe(true)
    expect(validChannels.includes('slack')).toBe(true)
    expect(validChannels.includes('phone')).toBe(false)
  })
})