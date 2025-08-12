// HubSpot CRM Provider Implementation for GTM System
import { CRMProvider, CRMContact, CRMCompany, CRMDeal, CRMEvent } from './types'
import { HubSpotClient } from './hubspot'

export class HubSpotProvider implements CRMProvider {
  private client: HubSpotClient

  constructor(apiToken: string) {
    this.client = new HubSpotClient(apiToken)
  }

  // Contact operations
  async createContact(contact: CRMContact): Promise<string> {
    const hubspotContact = this.mapToHubSpotContact(contact)
    const result = await this.client.upsertContact(hubspotContact)
    return result.id
  }

  async updateContact(contactId: string, contact: Partial<CRMContact>): Promise<void> {
    const hubspotContact = this.mapToHubSpotContact(contact)
    await this.makeRequest(`/crm/v3/objects/contacts/${contactId}`, 'PATCH', {
      properties: hubspotContact
    })
  }

  async getContact(contactId: string): Promise<CRMContact | null> {
    try {
      const response = await this.makeRequest(`/crm/v3/objects/contacts/${contactId}`)
      return this.mapFromHubSpotContact(response.properties)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async findContactByEmail(email: string): Promise<CRMContact | null> {
    const result = await this.client.findContactByEmail(email)
    if (!result) return null
    
    return {
      id: result.id,
      ...this.mapFromHubSpotContact(result.properties)
    }
  }

  async upsertContact(contact: CRMContact): Promise<string> {
    const result = await this.client.upsertContact(this.mapToHubSpotContact(contact))
    return result.id
  }

  // Company operations
  async createCompany(company: CRMCompany): Promise<string> {
    const properties = this.mapToHubSpotCompany(company)
    const response = await this.makeRequest('/crm/v3/objects/companies', 'POST', {
      properties
    })
    return response.id
  }

  async updateCompany(companyId: string, company: Partial<CRMCompany>): Promise<void> {
    const properties = this.mapToHubSpotCompany(company)
    await this.makeRequest(`/crm/v3/objects/companies/${companyId}`, 'PATCH', {
      properties
    })
  }

  async getCompany(companyId: string): Promise<CRMCompany | null> {
    try {
      const response = await this.makeRequest(`/crm/v3/objects/companies/${companyId}`)
      return this.mapFromHubSpotCompany(response.properties)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async findCompanyByDomain(domain: string): Promise<CRMCompany | null> {
    try {
      const response = await this.makeRequest(
        `/crm/v3/objects/companies/search`, 
        'POST',
        {
          filterGroups: [{
            filters: [{
              propertyName: 'domain',
              operator: 'EQ',
              value: domain
            }]
          }]
        }
      )

      if (response.results && response.results.length > 0) {
        const company = response.results[0]
        return {
          id: company.id,
          ...this.mapFromHubSpotCompany(company.properties)
        }
      }

      return null
    } catch (error) {
      console.error('Error finding company by domain:', error)
      return null
    }
  }

  async upsertCompany(company: CRMCompany): Promise<string> {
    // Try to find existing company by domain
    if (company.domain) {
      const existingCompany = await this.findCompanyByDomain(company.domain)
      if (existingCompany?.id) {
        await this.updateCompany(existingCompany.id, company)
        return existingCompany.id
      }
    }
    
    // Create new company
    return await this.createCompany(company)
  }

  // Deal operations
  async createDeal(deal: CRMDeal): Promise<string> {
    const properties = this.mapToHubSpotDeal(deal)
    const dealData: any = { properties }

    // Add associations if provided
    if (deal.contactId || deal.companyId) {
      dealData.associations = []
      
      if (deal.contactId) {
        dealData.associations.push({
          to: { id: deal.contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] // Deal to Contact
        })
      }
      
      if (deal.companyId) {
        dealData.associations.push({
          to: { id: deal.companyId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 5 }] // Deal to Company
        })
      }
    }

    const response = await this.makeRequest('/crm/v3/objects/deals', 'POST', dealData)
    return response.id
  }

  async updateDeal(dealId: string, deal: Partial<CRMDeal>): Promise<void> {
    const properties = this.mapToHubSpotDeal(deal)
    await this.makeRequest(`/crm/v3/objects/deals/${dealId}`, 'PATCH', {
      properties
    })
  }

  async getDeal(dealId: string): Promise<CRMDeal | null> {
    try {
      const response = await this.makeRequest(`/crm/v3/objects/deals/${dealId}`)
      return this.mapFromHubSpotDeal(response.properties)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async createOrUpdateDeal(deal: CRMDeal): Promise<string> {
    if (deal.id) {
      await this.updateDeal(deal.id, deal)
      return deal.id
    }
    return await this.createDeal(deal)
  }

  // Event operations
  async emitEvent(event: CRMEvent): Promise<void> {
    // For HubSpot, we can create timeline events or notes
    // This is a simplified implementation
    console.log('HubSpot event emitted:', event)
  }

  // Batch operations
  async batchUpsertContacts(contacts: CRMContact[]): Promise<string[]> {
    const results: string[] = []
    for (const contact of contacts) {
      try {
        const contactId = await this.upsertContact(contact)
        results.push(contactId)
      } catch (error) {
        console.error('Error upserting contact:', error)
      }
    }
    return results
  }

  // Webhook signature verification
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    return signature === expectedSignature
  }

  // Private helper methods
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    // Use the client's private makeRequest method (we'll need to expose it or recreate it)
    const url = `https://api.hubapi.com${endpoint}`
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HubSpot API error (${response.status}): ${errorText}`)
    }

    return await response.json()
  }

  private mapToHubSpotContact(contact: Partial<CRMContact>): any {
    const mapped: any = {}
    
    if (contact.email) mapped.email = contact.email
    if (contact.firstName) mapped.firstname = contact.firstName
    if (contact.lastName) mapped.lastname = contact.lastName
    if (contact.phone) mapped.phone = contact.phone
    if (contact.jobTitle) mapped.jobtitle = contact.jobTitle
    if (contact.company) mapped.company = contact.company
    if (contact.website) mapped.website = contact.website
    if (contact.industry) mapped.industry = contact.industry
    if (contact.country) mapped.country = contact.country
    if (contact.source) mapped.hs_lead_status = contact.source
    if (contact.utmSource) mapped.hs_analytics_source = contact.utmSource
    if (contact.utmMedium) mapped.hs_analytics_source_data_1 = contact.utmMedium
    if (contact.utmCampaign) mapped.hs_analytics_source_data_2 = contact.utmCampaign
    if (contact.leadScore !== undefined) mapped.hubspotscore = contact.leadScore
    if (contact.leadGrade) mapped.lead_grade = contact.leadGrade

    return mapped
  }

  private mapFromHubSpotContact(properties: any): CRMContact {
    return {
      email: properties.email || '',
      firstName: properties.firstname,
      lastName: properties.lastname,
      phone: properties.phone,
      jobTitle: properties.jobtitle,
      company: properties.company,
      website: properties.website,
      industry: properties.industry,
      country: properties.country,
      source: properties.hs_lead_status,
      utmSource: properties.hs_analytics_source,
      utmMedium: properties.hs_analytics_source_data_1,
      utmCampaign: properties.hs_analytics_source_data_2,
      leadScore: properties.hubspotscore ? parseInt(properties.hubspotscore) : undefined,
      leadGrade: properties.lead_grade
    }
  }

  private mapToHubSpotCompany(company: Partial<CRMCompany>): any {
    const mapped: any = {}
    
    if (company.name) mapped.name = company.name
    if (company.domain) mapped.domain = company.domain
    if (company.website) mapped.website = company.website
    if (company.industry) mapped.industry = company.industry
    if (company.size) mapped.numberofemployees = this.mapCompanySizeToNumber(company.size)
    if (company.country) mapped.country = company.country
    if (company.phone) mapped.phone = company.phone
    if (company.description) mapped.description = company.description

    return mapped
  }

  private mapFromHubSpotCompany(properties: any): CRMCompany {
    return {
      name: properties.name || '',
      domain: properties.domain,
      website: properties.website,
      industry: properties.industry,
      size: this.mapNumberToCompanySize(properties.numberofemployees),
      country: properties.country,
      phone: properties.phone,
      description: properties.description
    }
  }

  private mapToHubSpotDeal(deal: Partial<CRMDeal>): any {
    const mapped: any = {}
    
    if (deal.name) mapped.dealname = deal.name
    if (deal.amount !== undefined) mapped.amount = deal.amount
    if (deal.stage) mapped.dealstage = deal.stage
    if (deal.pipeline) mapped.pipeline = deal.pipeline
    if (deal.probability !== undefined) mapped.probability = deal.probability
    if (deal.expectedCloseDate) mapped.closedate = deal.expectedCloseDate.toISOString().split('T')[0]
    if (deal.source) mapped.leadsource = deal.source
    if (deal.description) mapped.description = deal.description

    return mapped
  }

  private mapFromHubSpotDeal(properties: any): CRMDeal {
    return {
      name: properties.dealname || '',
      amount: properties.amount ? parseFloat(properties.amount) : undefined,
      stage: properties.dealstage,
      pipeline: properties.pipeline,
      probability: properties.probability ? parseFloat(properties.probability) : undefined,
      expectedCloseDate: properties.closedate ? new Date(properties.closedate) : undefined,
      source: properties.leadsource,
      description: properties.description
    }
  }

  private mapCompanySizeToNumber(size: string): string {
    const sizeMap: Record<string, string> = {
      '1-10': '1-10',
      '11-50': '11-50',
      '51-200': '51-200',
      '201-1000': '201-1000',
      '1000+': '1000+'
    }
    return sizeMap[size] || size
  }

  private mapNumberToCompanySize(numberStr: string): string {
    return numberStr || ''
  }
}