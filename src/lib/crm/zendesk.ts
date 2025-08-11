/**
 * Zendesk CRM Integration
 * Handles ticket creation, user management, and organization tracking
 */

import { z } from 'zod'

const zendeskDomain = process.env.ZENDESK_DOMAIN // e.g., 'mycompany.zendesk.com'
const zendeskToken = process.env.ZENDESK_TOKEN
const zendeskEmail = process.env.ZENDESK_EMAIL // Admin email for authentication

// Validation schemas
const ZendeskUserSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  organization_id: z.number().optional(),
  role: z.enum(['end-user', 'agent', 'admin']).default('end-user')
})

const ZendeskTicketSchema = z.object({
  subject: z.string(),
  comment: z.object({
    body: z.string(),
    public: z.boolean().default(true)
  }),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).default('new'),
  type: z.enum(['problem', 'incident', 'question', 'task']).default('problem'),
  requester_id: z.number().optional(),
  assignee_id: z.number().optional(),
  tags: z.array(z.string()).optional()
})

interface ZendeskTicketData {
  subject: string
  description: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status?: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed'
  type?: 'problem' | 'incident' | 'question' | 'task'
  requesterId?: number
  assigneeId?: number
  tags?: string[]
  customFields?: Record<string, any>
}

interface ZendeskUser {
  name: string
  email?: string
  phone?: string
  organizationId?: number
  role?: 'end-user' | 'agent' | 'admin'
}

interface ZendeskApiResponse {
  id: number
  url: string
  created_at: string
  updated_at: string
  [key: string]: any
}

export class ZendeskClient {
  private readonly domain: string
  private readonly token: string
  private readonly email: string
  private readonly baseUrl: string

  constructor(domain?: string, token?: string, email?: string) {
    this.domain = domain || zendeskDomain || ''
    this.token = token || zendeskToken || ''
    this.email = email || zendeskEmail || ''
    this.baseUrl = `https://${this.domain}/api/v2`
    
    if (!this.domain || !this.token || !this.email) {
      throw new Error('Zendesk domain, token, and email are required')
    }
  }

  private async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    
    // Create basic auth header
    const auth = Buffer.from(`${this.email}/token:${this.token}`).toString('base64')
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Zendesk API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Create or update a user in Zendesk
   */
  async upsertUser(userData: ZendeskUser): Promise<ZendeskApiResponse> {
    const validatedData = ZendeskUserSchema.parse(userData)
    
    // Try to find existing user by email
    let existingUser = null
    if (userData.email) {
      try {
        existingUser = await this.findUserByEmail(userData.email)
      } catch (error) {
        // User not found, will create new
      }
    }

    if (existingUser) {
      // Update existing user
      return this.makeRequest(`/users/${existingUser.id}.json`, 'PUT', {
        user: validatedData
      })
    } else {
      // Create new user
      const result = await this.makeRequest('/users.json', 'POST', {
        user: validatedData
      })
      return result.user
    }
  }

  /**
   * Find user by email address
   */
  async findUserByEmail(email: string): Promise<ZendeskApiResponse | null> {
    try {
      const result = await this.makeRequest(`/users/search.json?query=email:${encodeURIComponent(email)}`)
      return result.users?.[0] || null
    } catch (error) {
      console.error('Error finding Zendesk user by email:', error)
      return null
    }
  }

  /**
   * Create a ticket in Zendesk
   */
  async createTicket(ticketData: ZendeskTicketData): Promise<ZendeskApiResponse> {
    const ticketPayload = {
      subject: ticketData.subject,
      comment: {
        body: ticketData.description,
        public: true
      },
      priority: ticketData.priority,
      status: ticketData.status || 'new',
      type: ticketData.type || 'problem',
      tags: ticketData.tags || []
    }

    // Add requester if provided
    if (ticketData.requesterId) {
      (ticketPayload as any).requester_id = ticketData.requesterId
    }

    // Add assignee if provided
    if (ticketData.assigneeId) {
      (ticketPayload as any).assignee_id = ticketData.assigneeId
    }

    // Add custom fields if provided
    if (ticketData.customFields) {
      (ticketPayload as any).custom_fields = Object.entries(ticketData.customFields).map(([id, value]) => ({
        id: parseInt(id),
        value
      }))
    }

    const validatedData = ZendeskTicketSchema.parse(ticketPayload)
    
    const result = await this.makeRequest('/tickets.json', 'POST', {
      ticket: validatedData
    })
    
    return result.ticket
  }

  /**
   * Update a ticket in Zendesk
   */
  async updateTicket(ticketId: number, updates: Partial<ZendeskTicketData>): Promise<ZendeskApiResponse> {
    const updatePayload: any = {}
    
    if (updates.subject) updatePayload.subject = updates.subject
    if (updates.priority) updatePayload.priority = updates.priority
    if (updates.status) updatePayload.status = updates.status
    if (updates.type) updatePayload.type = updates.type
    if (updates.tags) updatePayload.tags = updates.tags
    if (updates.assigneeId) updatePayload.assignee_id = updates.assigneeId

    // Add comment if description provided
    if (updates.description) {
      updatePayload.comment = {
        body: updates.description,
        public: true
      }
    }

    // Add custom fields if provided
    if (updates.customFields) {
      updatePayload.custom_fields = Object.entries(updates.customFields).map(([id, value]) => ({
        id: parseInt(id),
        value
      }))
    }

    const result = await this.makeRequest(`/tickets/${ticketId}.json`, 'PUT', {
      ticket: updatePayload
    })
    
    return result.ticket
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: number): Promise<ZendeskApiResponse> {
    const result = await this.makeRequest(`/tickets/${ticketId}.json`)
    return result.ticket
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: number, resolution?: string): Promise<ZendeskApiResponse> {
    const updatePayload: any = {
      status: 'solved'
    }
    
    if (resolution) {
      updatePayload.comment = {
        body: `Ticket resolved: ${resolution}`,
        public: false
      }
    }

    const result = await this.makeRequest(`/tickets/${ticketId}.json`, 'PUT', {
      ticket: updatePayload
    })
    
    return result.ticket
  }

  /**
   * Add comment to ticket
   */
  async addCommentToTicket(ticketId: number, comment: string, isPublic: boolean = true): Promise<ZendeskApiResponse> {
    const result = await this.makeRequest(`/tickets/${ticketId}.json`, 'PUT', {
      ticket: {
        comment: {
          body: comment,
          public: isPublic
        }
      }
    })
    
    return result.ticket
  }

  /**
   * Add tags to ticket
   */
  async addTagsToTicket(ticketId: number, tags: string[]): Promise<ZendeskApiResponse> {
    // First get current tags
    const ticket = await this.getTicket(ticketId)
    const currentTags = ticket.tags || []
    const newTags = [...new Set([...currentTags, ...tags])]

    const result = await this.makeRequest(`/tickets/${ticketId}.json`, 'PUT', {
      ticket: { tags: newTags }
    })
    
    return result.ticket
  }

  /**
   * Get ticket metrics
   */
  async getTicketMetrics(ticketId: number): Promise<any> {
    const result = await this.makeRequest(`/tickets/${ticketId}/metrics.json`)
    return result.ticket_metric
  }

  /**
   * Test connection to Zendesk API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/users/me.json')
      return true
    } catch (error) {
      console.error('Zendesk connection test failed:', error)
      return false
    }
  }
}

/**
 * Factory function for creating Zendesk client
 */
export function createZendeskClient(domain?: string, token?: string, email?: string): ZendeskClient {
  return new ZendeskClient(domain, token, email)
}

/**
 * Helper function to create escalation ticket in Zendesk
 */
export async function createEscalationTicket(
  client: ZendeskClient,
  ticketData: {
    subject: string
    description: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
    customerEmail?: string
    customerPhone?: string
    customerName?: string
    tags?: string[]
    customFields?: Record<string, any>
  }
): Promise<{ ticketId: number, userId?: number }> {
  
  let userId: number | undefined

  // Create or find user if customer info provided
  if (ticketData.customerEmail || ticketData.customerName) {
    try {
      const user = await client.upsertUser({
        name: ticketData.customerName || 'Unknown Customer',
        email: ticketData.customerEmail,
        phone: ticketData.customerPhone
      })
      userId = user.id
    } catch (error) {
      console.warn('Failed to create/update Zendesk user:', error)
      // Continue without user association
    }
  }

  // Create the ticket
  const ticket = await client.createTicket({
    subject: ticketData.subject,
    description: ticketData.description,
    priority: ticketData.priority,
    requesterId: userId,
    tags: [...(ticketData.tags || []), 'escalation', 'api-created'],
    customFields: ticketData.customFields
  })

  return {
    ticketId: ticket.id,
    userId
  }
}