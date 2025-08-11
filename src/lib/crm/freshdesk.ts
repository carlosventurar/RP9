/**
 * Freshdesk CRM Integration
 * Handles ticket creation, contact management, and company tracking
 */

import { z } from 'zod'

const freshdeskDomain = process.env.FRESHDESK_DOMAIN // e.g., 'mycompany.freshdesk.com'
const freshdeskToken = process.env.FRESHDESK_TOKEN

// Validation schemas
const FreshdeskContactSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  company_id: z.number().optional(),
  job_title: z.string().optional(),
  language: z.string().default('en'),
  time_zone: z.string().default('Eastern Time (US & Canada)')
})

const FreshdeskTicketSchema = z.object({
  subject: z.string(),
  description: z.string(),
  priority: z.enum([1, 2, 3, 4]), // 1=Low, 2=Medium, 3=High, 4=Urgent
  status: z.enum([2, 3, 4, 5, 6, 7]).default(2), // 2=Open, 3=Pending, 4=Resolved, 5=Closed, 6=Waiting on Customer, 7=Waiting on Third Party
  type: z.string().optional(),
  source: z.enum([1, 2, 3, 7, 8, 9, 10]).default(2), // 1=Email, 2=Portal, 3=Phone, 7=Chat, 8=Mobihelp, 9=Feedback Widget, 10=Outbound Email
  requester_id: z.number().optional(),
  responder_id: z.number().optional(),
  company_id: z.number().optional(),
  product_id: z.number().optional(),
  group_id: z.number().optional(),
  tags: z.array(z.string()).optional()
})

interface FreshdeskTicketData {
  subject: string
  description: string
  priority: 1 | 2 | 3 | 4 // 1=Low, 2=Medium, 3=High, 4=Urgent
  status?: 2 | 3 | 4 | 5 | 6 | 7
  type?: string
  source?: 1 | 2 | 3 | 7 | 8 | 9 | 10
  requesterId?: number
  responderId?: number
  companyId?: number
  productId?: number
  groupId?: number
  tags?: string[]
  customFields?: Record<string, any>
}

interface FreshdeskContact {
  name: string
  email?: string
  phone?: string
  mobile?: string
  companyId?: number
  jobTitle?: string
  language?: string
  timeZone?: string
}

interface FreshdeskApiResponse {
  id: number
  created_at: string
  updated_at: string
  [key: string]: any
}

export class FreshdeskClient {
  private readonly domain: string
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(domain?: string, apiKey?: string) {
    this.domain = domain || freshdeskDomain || ''
    this.apiKey = apiKey || freshdeskToken || ''
    this.baseUrl = `https://${this.domain}/api/v2`
    
    if (!this.domain || !this.apiKey) {
      throw new Error('Freshdesk domain and API key are required')
    }
  }

  private async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    
    // Create basic auth header (API key + X)
    const auth = Buffer.from(`${this.apiKey}:X`).toString('base64')
    
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
      throw new Error(`Freshdesk API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Create or update a contact in Freshdesk
   */
  async upsertContact(contactData: FreshdeskContact): Promise<FreshdeskApiResponse> {
    const validatedData = FreshdeskContactSchema.parse({
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      mobile: contactData.mobile,
      company_id: contactData.companyId,
      job_title: contactData.jobTitle,
      language: contactData.language || 'en',
      time_zone: contactData.timeZone || 'Eastern Time (US & Canada)'
    })
    
    // Try to find existing contact by email
    let existingContact = null
    if (contactData.email) {
      try {
        existingContact = await this.findContactByEmail(contactData.email)
      } catch (error) {
        // Contact not found, will create new
      }
    }

    if (existingContact) {
      // Update existing contact
      return this.makeRequest(`/contacts/${existingContact.id}`, 'PUT', validatedData)
    } else {
      // Create new contact
      return this.makeRequest('/contacts', 'POST', validatedData)
    }
  }

  /**
   * Find contact by email address
   */
  async findContactByEmail(email: string): Promise<FreshdeskApiResponse | null> {
    try {
      const result = await this.makeRequest(`/contacts?email=${encodeURIComponent(email)}`)
      return result[0] || null
    } catch (error) {
      console.error('Error finding Freshdesk contact by email:', error)
      return null
    }
  }

  /**
   * Create a ticket in Freshdesk
   */
  async createTicket(ticketData: FreshdeskTicketData): Promise<FreshdeskApiResponse> {
    const ticketPayload: any = {
      subject: ticketData.subject,
      description: ticketData.description,
      priority: ticketData.priority,
      status: ticketData.status || 2,
      source: ticketData.source || 2,
      tags: ticketData.tags || []
    }

    // Add optional fields
    if (ticketData.type) ticketPayload.type = ticketData.type
    if (ticketData.requesterId) ticketPayload.requester_id = ticketData.requesterId
    if (ticketData.responderId) ticketPayload.responder_id = ticketData.responderId
    if (ticketData.companyId) ticketPayload.company_id = ticketData.companyId
    if (ticketData.productId) ticketPayload.product_id = ticketData.productId
    if (ticketData.groupId) ticketPayload.group_id = ticketData.groupId

    // Add custom fields if provided
    if (ticketData.customFields) {
      Object.assign(ticketPayload, ticketData.customFields)
    }

    const validatedData = FreshdeskTicketSchema.parse(ticketPayload)
    
    return this.makeRequest('/tickets', 'POST', validatedData)
  }

  /**
   * Update a ticket in Freshdesk
   */
  async updateTicket(ticketId: number, updates: Partial<FreshdeskTicketData>): Promise<FreshdeskApiResponse> {
    const updatePayload: any = {}
    
    if (updates.subject) updatePayload.subject = updates.subject
    if (updates.description) updatePayload.description = updates.description
    if (updates.priority) updatePayload.priority = updates.priority
    if (updates.status) updatePayload.status = updates.status
    if (updates.type) updatePayload.type = updates.type
    if (updates.tags) updatePayload.tags = updates.tags
    if (updates.responderId) updatePayload.responder_id = updates.responderId
    if (updates.groupId) updatePayload.group_id = updates.groupId

    // Add custom fields if provided
    if (updates.customFields) {
      Object.assign(updatePayload, updates.customFields)
    }

    return this.makeRequest(`/tickets/${ticketId}`, 'PUT', updatePayload)
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: number): Promise<FreshdeskApiResponse> {
    return this.makeRequest(`/tickets/${ticketId}`)
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: number, resolution?: string): Promise<FreshdeskApiResponse> {
    const updatePayload: any = {
      status: 5 // Closed
    }
    
    if (resolution) {
      // Add private note with resolution
      await this.addNoteToTicket(ticketId, resolution, false)
    }

    return this.makeRequest(`/tickets/${ticketId}`, 'PUT', updatePayload)
  }

  /**
   * Add note to ticket
   */
  async addNoteToTicket(ticketId: number, note: string, isPrivate: boolean = false): Promise<FreshdeskApiResponse> {
    return this.makeRequest(`/tickets/${ticketId}/notes`, 'POST', {
      body: note,
      private: isPrivate
    })
  }

  /**
   * Add reply to ticket
   */
  async addReplyToTicket(ticketId: number, body: string, fromEmail?: string): Promise<FreshdeskApiResponse> {
    const replyData: any = {
      body,
    }
    
    if (fromEmail) {
      replyData.from_email = fromEmail
    }

    return this.makeRequest(`/tickets/${ticketId}/reply`, 'POST', replyData)
  }

  /**
   * Get ticket conversations
   */
  async getTicketConversations(ticketId: number): Promise<FreshdeskApiResponse[]> {
    return this.makeRequest(`/tickets/${ticketId}/conversations`)
  }

  /**
   * Get all agents
   */
  async getAgents(): Promise<FreshdeskApiResponse[]> {
    return this.makeRequest('/agents')
  }

  /**
   * Get all groups
   */
  async getGroups(): Promise<FreshdeskApiResponse[]> {
    return this.makeRequest('/groups')
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats(groupId?: number, agentId?: number): Promise<any> {
    let endpoint = '/tickets/stats'
    const params = []
    
    if (groupId) params.push(`group_id=${groupId}`)
    if (agentId) params.push(`agent_id=${agentId}`)
    
    if (params.length > 0) {
      endpoint += `?${params.join('&')}`
    }
    
    return this.makeRequest(endpoint)
  }

  /**
   * Test connection to Freshdesk API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/agents/me')
      return true
    } catch (error) {
      console.error('Freshdesk connection test failed:', error)
      return false
    }
  }

  /**
   * Map priority string to Freshdesk priority number
   */
  static mapPriority(priority: 'low' | 'medium' | 'high' | 'urgent'): 1 | 2 | 3 | 4 {
    const priorityMap = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'urgent': 4
    } as const
    
    return priorityMap[priority]
  }

  /**
   * Map status string to Freshdesk status number
   */
  static mapStatus(status: 'open' | 'pending' | 'resolved' | 'closed' | 'waiting_customer' | 'waiting_third_party'): 2 | 3 | 4 | 5 | 6 | 7 {
    const statusMap = {
      'open': 2,
      'pending': 3,
      'resolved': 4,
      'closed': 5,
      'waiting_customer': 6,
      'waiting_third_party': 7
    } as const
    
    return statusMap[status]
  }
}

/**
 * Factory function for creating Freshdesk client
 */
export function createFreshdeskClient(domain?: string, apiKey?: string): FreshdeskClient {
  return new FreshdeskClient(domain, apiKey)
}

/**
 * Helper function to create escalation ticket in Freshdesk
 */
export async function createEscalationTicket(
  client: FreshdeskClient,
  ticketData: {
    subject: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    customerEmail?: string
    customerPhone?: string
    customerName?: string
    tags?: string[]
    customFields?: Record<string, any>
  }
): Promise<{ ticketId: number, contactId?: number }> {
  
  let contactId: number | undefined

  // Create or find contact if customer info provided
  if (ticketData.customerEmail || ticketData.customerName) {
    try {
      const contact = await client.upsertContact({
        name: ticketData.customerName || 'Unknown Customer',
        email: ticketData.customerEmail,
        phone: ticketData.customerPhone
      })
      contactId = contact.id
    } catch (error) {
      console.warn('Failed to create/update Freshdesk contact:', error)
      // Continue without contact association
    }
  }

  // Create the ticket
  const ticket = await client.createTicket({
    subject: ticketData.subject,
    description: ticketData.description,
    priority: FreshdeskClient.mapPriority(ticketData.priority),
    requesterId: contactId,
    tags: [...(ticketData.tags || []), 'escalation', 'api-created'],
    customFields: ticketData.customFields
  })

  return {
    ticketId: ticket.id,
    contactId
  }
}