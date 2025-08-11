/**
 * HubSpot CRM Integration
 * Handles ticket creation, contact management, and deal tracking
 */

import { z } from 'zod'

const hubspotApiUrl = 'https://api.hubapi.com'
const hubspotToken = process.env.HUBSPOT_TOKEN

// Validation schemas
const HubSpotContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  company: z.string().optional()
})

const HubSpotTicketSchema = z.object({
  subject: z.string(),
  content: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  status: z.enum(['NEW', 'WAITING_ON_CONTACT', 'WAITING_ON_US', 'CLOSED']).default('NEW'),
  source: z.string().default('API'),
  contactId: z.string().optional()
})

interface HubSpotTicketData {
  subject: string
  content: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status?: 'NEW' | 'WAITING_ON_CONTACT' | 'WAITING_ON_US' | 'CLOSED'
  source?: string
  contactId?: string
  customProperties?: Record<string, string>
}

interface HubSpotContact {
  email?: string
  phone?: string
  firstname?: string
  lastname?: string
  company?: string
}

interface HubSpotApiResponse {
  id: string
  properties: Record<string, any>
  createdAt: string
  updatedAt: string
}

export class HubSpotClient {
  private readonly apiToken: string
  private readonly baseUrl: string

  constructor(apiToken?: string) {
    this.apiToken = apiToken || hubspotToken || ''
    this.baseUrl = hubspotApiUrl
    
    if (!this.apiToken) {
      throw new Error('HubSpot API token is required')
    }
  }

  private async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HubSpot API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Create or update a contact in HubSpot
   */
  async upsertContact(contactData: HubSpotContact): Promise<HubSpotApiResponse> {
    const validatedData = HubSpotContactSchema.parse(contactData)
    
    // Convert to HubSpot properties format
    const properties = Object.entries(validatedData).reduce((acc, [key, value]) => {
      if (value) {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, any>)

    // Try to find existing contact by email or phone
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
      return this.makeRequest(`/crm/v3/objects/contacts/${existingContact.id}`, 'PATCH', {
        properties
      })
    } else {
      // Create new contact
      return this.makeRequest('/crm/v3/objects/contacts', 'POST', {
        properties
      })
    }
  }

  /**
   * Find contact by email address
   */
  async findContactByEmail(email: string): Promise<HubSpotApiResponse | null> {
    try {
      const result = await this.makeRequest(
        `/crm/v3/objects/contacts/search`,
        'POST',
        {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }]
          }]
        }
      )
      
      return result.results?.[0] || null
    } catch (error) {
      console.error('Error finding HubSpot contact by email:', error)
      return null
    }
  }

  /**
   * Create a ticket in HubSpot
   */
  async createTicket(ticketData: HubSpotTicketData): Promise<HubSpotApiResponse> {
    const validatedData = HubSpotTicketSchema.parse(ticketData)
    
    // Convert to HubSpot properties format
    const properties: Record<string, any> = {
      subject: validatedData.subject,
      content: validatedData.content,
      hs_pipeline_stage: this.mapStatusToPipelineStage(validatedData.status || 'NEW'),
      hs_ticket_priority: validatedData.priority,
      source_type: validatedData.source || 'API',
      ...ticketData.customProperties
    }

    // Add contact association if provided
    const associations = []
    if (ticketData.contactId) {
      associations.push({
        to: { id: ticketData.contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 16 }] // Ticket to Contact
      })
    }

    const payload: any = { properties }
    if (associations.length > 0) {
      payload.associations = associations
    }

    return this.makeRequest('/crm/v3/objects/tickets', 'POST', payload)
  }

  /**
   * Update a ticket in HubSpot
   */
  async updateTicket(ticketId: string, updates: Partial<HubSpotTicketData>): Promise<HubSpotApiResponse> {
    const properties: Record<string, any> = {}
    
    if (updates.subject) properties.subject = updates.subject
    if (updates.content) properties.content = updates.content
    if (updates.priority) properties.hs_ticket_priority = updates.priority
    if (updates.status) properties.hs_pipeline_stage = this.mapStatusToPipelineStage(updates.status)
    
    // Add custom properties
    if (updates.customProperties) {
      Object.assign(properties, updates.customProperties)
    }

    return this.makeRequest(`/crm/v3/objects/tickets/${ticketId}`, 'PATCH', {
      properties
    })
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: string): Promise<HubSpotApiResponse> {
    return this.makeRequest(`/crm/v3/objects/tickets/${ticketId}`)
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: string, resolution?: string): Promise<HubSpotApiResponse> {
    const properties: Record<string, any> = {
      hs_pipeline_stage: this.mapStatusToPipelineStage('CLOSED')
    }
    
    if (resolution) {
      properties.hs_resolution = resolution
    }

    return this.makeRequest(`/crm/v3/objects/tickets/${ticketId}`, 'PATCH', {
      properties
    })
  }

  /**
   * Add note to ticket
   */
  async addNoteToTicket(ticketId: string, note: string): Promise<HubSpotApiResponse> {
    return this.makeRequest('/crm/v3/objects/notes', 'POST', {
      properties: {
        hs_note_body: note,
        hs_timestamp: new Date().toISOString()
      },
      associations: [{
        to: { id: ticketId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] // Note to Ticket
      }]
    })
  }

  /**
   * Map internal status to HubSpot pipeline stage
   */
  private mapStatusToPipelineStage(status: string): string {
    const stageMap: Record<string, string> = {
      'NEW': '1',                    // New
      'WAITING_ON_CONTACT': '2',     // Waiting on contact  
      'WAITING_ON_US': '3',          // Waiting on us
      'CLOSED': '4'                  // Closed
    }
    
    return stageMap[status] || '1'
  }

  /**
   * Test connection to HubSpot API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/crm/v3/objects/contacts?limit=1')
      return true
    } catch (error) {
      console.error('HubSpot connection test failed:', error)
      return false
    }
  }
}

/**
 * Factory function for creating HubSpot client
 */
export function createHubSpotClient(apiToken?: string): HubSpotClient {
  return new HubSpotClient(apiToken)
}

/**
 * Helper function to create escalation ticket in HubSpot
 */
export async function createEscalationTicket(
  client: HubSpotClient,
  ticketData: {
    subject: string
    description: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    customerEmail?: string
    customerPhone?: string
    customProperties?: Record<string, string>
  }
): Promise<{ ticketId: string, contactId?: string }> {
  
  let contactId: string | undefined

  // Create or find contact if customer info provided
  if (ticketData.customerEmail || ticketData.customerPhone) {
    try {
      const contact = await client.upsertContact({
        email: ticketData.customerEmail,
        phone: ticketData.customerPhone
      })
      contactId = contact.id
    } catch (error) {
      console.warn('Failed to create/update HubSpot contact:', error)
      // Continue without contact association
    }
  }

  // Create the ticket
  const ticket = await client.createTicket({
    subject: ticketData.subject,
    content: ticketData.description,
    priority: ticketData.priority,
    contactId,
    customProperties: {
      source_type: 'escalation',
      ...ticketData.customProperties
    }
  })

  return {
    ticketId: ticket.id,
    contactId
  }
}