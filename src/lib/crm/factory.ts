// CRM Factory and Configuration
import { CRMProvider, CRMConfig } from './types'
import { HubSpotProvider } from './hubspot-provider'

export function createCRMProvider(config?: CRMConfig): CRMProvider {
  const provider = config?.provider || process.env.CRM_PROVIDER || 'hubspot'
  
  switch (provider) {
    case 'hubspot':
      const hubspotToken = config?.hubspot?.accessToken || process.env.HUBSPOT_TOKEN
      if (!hubspotToken) {
        throw new Error('HubSpot access token is required')
      }
      return new HubSpotProvider(hubspotToken)
    
    case 'freshsales':
      // TODO: Implement FreshsalesProvider when needed
      throw new Error('Freshsales provider not yet implemented')
    
    default:
      throw new Error(`Unsupported CRM provider: ${provider}`)
  }
}

// Default CRM instance
let defaultCRMProvider: CRMProvider | null = null

export function getDefaultCRMProvider(): CRMProvider {
  if (!defaultCRMProvider) {
    defaultCRMProvider = createCRMProvider()
  }
  return defaultCRMProvider
}

// Helper function to extract domain from email
export function extractDomainFromEmail(email: string): string {
  const parts = email.split('@')
  return parts.length > 1 ? parts[1].toLowerCase() : ''
}

// Helper function to generate deal name
export function generateDealName(companyName?: string, source?: string): string {
  const timestamp = new Date().toISOString().split('T')[0]
  const company = companyName || 'Unknown Company'
  const sourceType = source || 'web'
  
  return `${company} - ${sourceType} - ${timestamp}`
}

// Helper function to determine deal stage based on lead source and requests
export function getDealStageFromLead(source: string, demoRequested: boolean, pilotRequested: boolean): string {
  if (pilotRequested) {
    return 'pilot-discussion'
  }
  
  if (demoRequested) {
    return 'demo-scheduled'
  }
  
  // High-intent sources
  const highIntentSources = ['roi-calculator', 'webinar', 'demo-request']
  if (highIntentSources.includes(source)) {
    return 'qualified'
  }
  
  return 'initial-contact'
}

// Helper function to calculate deal probability based on stage
export function getDealProbability(stage: string): number {
  const probabilityMap: Record<string, number> = {
    'initial-contact': 10,
    'qualified': 25,
    'demo-scheduled': 40,
    'demo-completed': 60,
    'pilot-discussion': 75,
    'pilot-approved': 90,
    'contract-negotiation': 95,
    'closed-won': 100,
    'closed-lost': 0
  }
  
  return probabilityMap[stage] || 10
}

// Helper function to get deal amount based on company size and source
export function estimateDealAmount(companySize?: string, source?: string): number {
  const basePricing = {
    '1-10': 1000,      // Starter to Pro
    '11-50': 3000,     // Pro
    '51-200': 8000,    // Pro to Enterprise
    '201-1000': 15000, // Enterprise
    '1000+': 25000     // Enterprise+
  }
  
  const baseAmount = basePricing[companySize as keyof typeof basePricing] || 3000
  
  // High-intent sources get higher estimate
  const highIntentSources = ['roi-calculator', 'demo-request', 'pilot-request']
  const multiplier = highIntentSources.includes(source || '') ? 1.2 : 1
  
  return Math.round(baseAmount * multiplier)
}