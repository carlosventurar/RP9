/**
 * Unified CRM Interface
 * Provides a common interface for all CRM providers (HubSpot, Zendesk, Freshdesk)
 */

import { createHubSpotClient, createEscalationTicket as createHubSpotTicket } from './hubspot'
import { createZendeskClient, createEscalationTicket as createZendeskTicket } from './zendesk'
import { createFreshdeskClient, createEscalationTicket as createFreshdeskTicket } from './freshdesk'

export type CRMProvider = 'hubspot' | 'zendesk' | 'freshdesk' | 'internal'

export interface CRMTicketData {
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  customerEmail?: string
  customerPhone?: string
  customerName?: string
  tags?: string[]
  customFields?: Record<string, any>
}

export interface CRMTicketResult {
  ticketId: string | number
  contactId?: string | number
  provider: CRMProvider
  externalUrl?: string
}

export interface CRMClient {
  provider: CRMProvider
  createTicket(ticketData: CRMTicketData): Promise<CRMTicketResult>
  updateTicket(ticketId: string | number, updates: Partial<CRMTicketData>): Promise<any>
  getTicket(ticketId: string | number): Promise<any>
  closeTicket(ticketId: string | number, resolution?: string): Promise<any>
  testConnection(): Promise<boolean>
}

class HubSpotCRMClient implements CRMClient {
  provider: CRMProvider = 'hubspot'
  private client: ReturnType<typeof createHubSpotClient>

  constructor(apiToken?: string) {
    this.client = createHubSpotClient(apiToken)
  }

  async createTicket(ticketData: CRMTicketData): Promise<CRMTicketResult> {
    const priority = ticketData.priority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    
    const result = await createHubSpotTicket(this.client, {
      subject: ticketData.subject,
      description: ticketData.description,
      priority,
      customerEmail: ticketData.customerEmail,
      customerPhone: ticketData.customerPhone,
      customProperties: ticketData.customFields
    })

    const domain = process.env.HUBSPOT_DOMAIN || 'app.hubspot.com'
    const externalUrl = `https://${domain}/contacts/${result.ticketId}/tickets/${result.ticketId}`

    return {
      ticketId: result.ticketId,
      contactId: result.contactId,
      provider: this.provider,
      externalUrl
    }
  }

  async updateTicket(ticketId: string | number, updates: Partial<CRMTicketData>): Promise<any> {
    const priority = updates.priority?.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | undefined
    
    return this.client.updateTicket(String(ticketId), {
      subject: updates.subject,
      content: updates.description,
      priority,
      customProperties: updates.customFields
    })
  }

  async getTicket(ticketId: string | number): Promise<any> {
    return this.client.getTicket(String(ticketId))
  }

  async closeTicket(ticketId: string | number, resolution?: string): Promise<any> {
    return this.client.closeTicket(String(ticketId), resolution)
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection()
  }
}

class ZendeskCRMClient implements CRMClient {
  provider: CRMProvider = 'zendesk'
  private client: ReturnType<typeof createZendeskClient>

  constructor(domain?: string, token?: string, email?: string) {
    this.client = createZendeskClient(domain, token, email)
  }

  async createTicket(ticketData: CRMTicketData): Promise<CRMTicketResult> {
    const result = await createZendeskTicket(this.client, {
      subject: ticketData.subject,
      description: ticketData.description,
      priority: ticketData.priority,
      customerEmail: ticketData.customerEmail,
      customerPhone: ticketData.customerPhone,
      customerName: ticketData.customerName,
      tags: ticketData.tags,
      customFields: ticketData.customFields
    })

    const domain = process.env.ZENDESK_DOMAIN || 'mycompany.zendesk.com'
    const externalUrl = `https://${domain}/agent/tickets/${result.ticketId}`

    return {
      ticketId: result.ticketId,
      contactId: result.userId,
      provider: this.provider,
      externalUrl
    }
  }

  async updateTicket(ticketId: string | number, updates: Partial<CRMTicketData>): Promise<any> {
    return this.client.updateTicket(Number(ticketId), {
      subject: updates.subject,
      description: updates.description,
      priority: updates.priority,
      tags: updates.tags,
      customFields: updates.customFields
    })
  }

  async getTicket(ticketId: string | number): Promise<any> {
    return this.client.getTicket(Number(ticketId))
  }

  async closeTicket(ticketId: string | number, resolution?: string): Promise<any> {
    return this.client.closeTicket(Number(ticketId), resolution)
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection()
  }
}

class FreshdeskCRMClient implements CRMClient {
  provider: CRMProvider = 'freshdesk'
  private client: ReturnType<typeof createFreshdeskClient>

  constructor(domain?: string, apiKey?: string) {
    this.client = createFreshdeskClient(domain, apiKey)
  }

  async createTicket(ticketData: CRMTicketData): Promise<CRMTicketResult> {
    const result = await createFreshdeskTicket(this.client, {
      subject: ticketData.subject,
      description: ticketData.description,
      priority: ticketData.priority,
      customerEmail: ticketData.customerEmail,
      customerPhone: ticketData.customerPhone,
      customerName: ticketData.customerName,
      tags: ticketData.tags,
      customFields: ticketData.customFields
    })

    const domain = process.env.FRESHDESK_DOMAIN || 'mycompany.freshdesk.com'
    const externalUrl = `https://${domain}/a/tickets/${result.ticketId}`

    return {
      ticketId: result.ticketId,
      contactId: result.contactId,
      provider: this.provider,
      externalUrl
    }
  }

  async updateTicket(ticketId: string | number, updates: Partial<CRMTicketData>): Promise<any> {
    return this.client.updateTicket(Number(ticketId), {
      subject: updates.subject,
      description: updates.description,
      priority: updates.priority,
      tags: updates.tags,
      customFields: updates.customFields
    })
  }

  async getTicket(ticketId: string | number): Promise<any> {
    return this.client.getTicket(Number(ticketId))
  }

  async closeTicket(ticketId: string | number, resolution?: string): Promise<any> {
    return this.client.closeTicket(Number(ticketId), resolution)
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection()
  }
}

class InternalCRMClient implements CRMClient {
  provider: CRMProvider = 'internal'

  async createTicket(ticketData: CRMTicketData): Promise<CRMTicketResult> {
    // For internal CRM, we just store in our tickets table
    // This is handled by the calling function, so we return mock data
    const ticketId = `INT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      ticketId,
      provider: this.provider
    }
  }

  async updateTicket(ticketId: string | number, updates: Partial<CRMTicketData>): Promise<any> {
    // Internal tickets are updated directly in the database
    return { success: true, ticketId }
  }

  async getTicket(ticketId: string | number): Promise<any> {
    // Internal tickets are fetched directly from the database
    return { id: ticketId, provider: 'internal' }
  }

  async closeTicket(ticketId: string | number, resolution?: string): Promise<any> {
    // Internal tickets are closed directly in the database
    return { success: true, ticketId, resolution }
  }

  async testConnection(): Promise<boolean> {
    // Internal CRM is always available
    return true
  }
}

/**
 * Factory function to create CRM client based on provider
 */
export function createCRMClient(provider: CRMProvider): CRMClient {
  switch (provider) {
    case 'hubspot':
      return new HubSpotCRMClient(process.env.HUBSPOT_TOKEN)
    
    case 'zendesk':
      return new ZendeskCRMClient(
        process.env.ZENDESK_DOMAIN,
        process.env.ZENDESK_TOKEN,
        process.env.ZENDESK_EMAIL
      )
    
    case 'freshdesk':
      return new FreshdeskCRMClient(
        process.env.FRESHDESK_DOMAIN,
        process.env.FRESHDESK_TOKEN
      )
    
    case 'internal':
    default:
      return new InternalCRMClient()
  }
}

/**
 * Get available CRM providers based on environment configuration
 */
export function getAvailableCRMProviders(): CRMProvider[] {
  const providers: CRMProvider[] = ['internal']
  
  if (process.env.HUBSPOT_TOKEN) {
    providers.push('hubspot')
  }
  
  if (process.env.ZENDESK_DOMAIN && process.env.ZENDESK_TOKEN && process.env.ZENDESK_EMAIL) {
    providers.push('zendesk')
  }
  
  if (process.env.FRESHDESK_DOMAIN && process.env.FRESHDESK_TOKEN) {
    providers.push('freshdesk')
  }
  
  return providers
}

/**
 * Test connections to all configured CRM providers
 */
export async function testAllCRMConnections(): Promise<Record<CRMProvider, boolean>> {
  const providers = getAvailableCRMProviders()
  const results: Record<string, boolean> = {}
  
  for (const provider of providers) {
    try {
      const client = createCRMClient(provider)
      results[provider] = await client.testConnection()
    } catch (error) {
      console.error(`Error testing ${provider} connection:`, error)
      results[provider] = false
    }
  }
  
  return results as Record<CRMProvider, boolean>
}

/**
 * Helper function to create escalation ticket with automatic provider selection
 */
export async function createEscalationTicket(
  ticketData: CRMTicketData,
  preferredProvider?: CRMProvider
): Promise<CRMTicketResult> {
  // Use preferred provider if specified, otherwise use first available
  const availableProviders = getAvailableCRMProviders()
  const provider = preferredProvider && availableProviders.includes(preferredProvider) 
    ? preferredProvider 
    : availableProviders[0]
  
  const client = createCRMClient(provider)
  return client.createTicket(ticketData)
}

// Re-export individual CRM clients for direct use
export {
  createHubSpotClient,
  createZendeskClient,
  createFreshdeskClient
}