// CRM Types and Interfaces for GTM System
export interface CRMContact {
  id?: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  jobTitle?: string
  company?: string
  website?: string
  industry?: string
  country?: string
  source?: string
  // UTM parameters
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  // Custom properties
  leadScore?: number
  leadGrade?: string
  customProperties?: Record<string, any>
}

export interface CRMCompany {
  id?: string
  name: string
  domain?: string
  website?: string
  industry?: string
  size?: string
  country?: string
  phone?: string
  description?: string
  // Custom properties
  customProperties?: Record<string, any>
}

export interface CRMDeal {
  id?: string
  name: string
  contactId?: string
  companyId?: string
  amount?: number
  currency?: string
  stage?: string
  pipeline?: string
  probability?: number
  expectedCloseDate?: Date
  source?: string
  description?: string
  // Custom properties
  customProperties?: Record<string, any>
}

export interface CRMEvent {
  eventType: string
  eventSource: string
  contactId?: string
  companyId?: string
  dealId?: string
  properties?: Record<string, any>
  externalEventId?: string
}

// CRM Provider Interface
export interface CRMProvider {
  // Contact operations
  createContact(contact: CRMContact): Promise<string>
  updateContact(contactId: string, contact: Partial<CRMContact>): Promise<void>
  getContact(contactId: string): Promise<CRMContact | null>
  findContactByEmail(email: string): Promise<CRMContact | null>
  upsertContact(contact: CRMContact): Promise<string>
  
  // Company operations
  createCompany(company: CRMCompany): Promise<string>
  updateCompany(companyId: string, company: Partial<CRMCompany>): Promise<void>
  getCompany(companyId: string): Promise<CRMCompany | null>
  findCompanyByDomain(domain: string): Promise<CRMCompany | null>
  upsertCompany(company: CRMCompany): Promise<string>
  
  // Deal operations
  createDeal(deal: CRMDeal): Promise<string>
  updateDeal(dealId: string, deal: Partial<CRMDeal>): Promise<void>
  getDeal(dealId: string): Promise<CRMDeal | null>
  createOrUpdateDeal(deal: CRMDeal): Promise<string>
  
  // Event operations
  emitEvent(event: CRMEvent): Promise<void>
  
  // Batch operations
  batchUpsertContacts(contacts: CRMContact[]): Promise<string[]>
  
  // Provider-specific methods
  verifyWebhookSignature?(payload: string, signature: string, secret: string): boolean
}

// Lead data from database
export interface Lead {
  id: string
  email: string
  firstName?: string
  lastName?: string
  companyName?: string
  jobTitle?: string
  phone?: string
  website?: string
  industry?: string
  companySize?: string
  country?: string
  source?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  score: number
  grade: string
  hubspotContactId?: string
  hubspotCompanyId?: string
  freshsalesContactId?: string
  freshsalesAccountId?: string
  crmLastSyncAt?: Date
  status: string
  stage: string
  notes?: string
  roiCalculation?: any
  demoRequested: boolean
  demoScheduledAt?: Date
  pilotRequested: boolean
  createdAt: Date
  updatedAt: Date
}

// CRM event from database
export interface CRMEventRecord {
  id: string
  leadId: string
  eventType: string
  eventSource: string
  crmContactId?: string
  crmCompanyId?: string
  crmDealId?: string
  oldValue?: any
  newValue?: any
  properties?: any
  externalEventId?: string
  processed: boolean
  errorMessage?: string
  createdAt: Date
}

// Webinar registration
export interface WebinarRegistration {
  id: string
  leadId?: string
  email: string
  firstName?: string
  lastName?: string
  companyName?: string
  jobTitle?: string
  phone?: string
  webinarId: string
  webinarTitle: string
  webinarDate?: Date
  webinarType: string
  status: string
  attended: boolean
  attendanceDuration?: number
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  followUpSent: boolean
  followUpSentAt?: Date
  createdAt: Date
  updatedAt: Date
}

// ROI calculation event
export interface ROIEvent {
  id: string
  leadId?: string
  email?: string
  ipAddress?: string
  userAgent?: string
  teamSize: number
  avgHourlyRate: number
  manualTasksPerMonth: number
  timePerTask: number
  automationPercentage: number
  currentToolsCost: number
  industry?: string
  monthlySavings: number
  annualSavings: number
  roiPercentage: number
  paybackMonths: number
  hoursFreed: number
  sessionId?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  ctaClicked: boolean
  ctaType?: string
  leadGenerated: boolean
  createdAt: Date
}

// Partner application
export interface PartnerApplication {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName?: string
  phone?: string
  website?: string
  partnerType: string
  experienceLevel?: string
  specialties?: string[]
  targetIndustries?: string[]
  monthlyCapacity?: number
  currentClients?: number
  annualRevenue?: number
  teamSize?: number
  motivation?: string
  relevantExperience?: string
  referralSource?: string
  status: string
  tier?: string
  notes?: string
  reviewedBy?: string
  reviewedAt?: Date
  hubspotContactId?: string
  crmLastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Lead form submission
export interface LeadFormData {
  email: string
  firstName?: string
  lastName?: string
  companyName?: string
  jobTitle?: string
  phone?: string
  website?: string
  industry?: string
  companySize?: string
  country?: string
  source: string
  message?: string
  // Request types
  demoRequested?: boolean
  pilotRequested?: boolean
  // UTM parameters
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  // ROI calculation data (if from ROI form)
  roiCalculation?: any
}

// CRM configuration
export interface CRMConfig {
  provider: 'hubspot' | 'freshsales'
  hubspot?: {
    accessToken: string
    portalId?: string
    appId?: string
  }
  freshsales?: {
    domain: string
    apiToken: string
  }
  webhookSecret?: string
}

// GTM KPIs for dashboard
export interface GTMKPIs {
  period: string
  leads: {
    total: number
    new: number
    qualified: number
    converted: number
    conversionRate: number
  }
  pipeline: {
    totalDeals: number
    totalValue: number
    averageDealSize: number
    winRate: number
  }
  sources: Array<{
    source: string
    count: number
    percentage: number
  }>
  roi: {
    calculationsTotal: number
    averageSavings: number
    ctaClickRate: number
    leadConversionRate: number
  }
  webinars: {
    registrations: number
    attendance: number
    attendanceRate: number
    leadConversionRate: number
  }
  partners: {
    applications: number
    approved: number
    approvalRate: number
    referrals: number
  }
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface LeadSubmissionResponse {
  success: boolean
  leadId: string
  crmContactId?: string
  crmCompanyId?: string
  crmDealId?: string
  dealUrl?: string
  message: string
}

// Validation schemas (to be used with Zod)
export interface LeadValidationSchema {
  email: string
  firstName?: string
  lastName?: string
  companyName?: string
  jobTitle?: string
  phone?: string
  website?: string
  industry?: string
  companySize?: string
  country?: string
  source: string
}

// Webhook payload types
export interface HubSpotWebhookPayload {
  subscriptionId: number
  portalId: number
  appId: number
  eventId: number
  subscriptionType: string
  attemptNumber: number
  objectId: number
  changeSource: string
  changeFlag: string
  changeTimestamp: number
  propertyName?: string
  propertyValue?: any
  subscriptionName?: string
}

export interface FreshsalesWebhookPayload {
  event: string
  data: any
  timestamp: number
}

// Constants
export const LEAD_SOURCES = [
  'roi-calculator',
  'webinar',
  'partner',
  'organic',
  'paid-search',
  'social',
  'email',
  'referral',
  'direct',
  'content',
  'linkedin'
] as const

export const LEAD_STAGES = [
  'lead',
  'mql',
  'sql',
  'opportunity',
  'customer',
  'lost'
] as const

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'demo',
  'pilot',
  'customer',
  'lost'
] as const

export const DEAL_STAGES = [
  'initial-contact',
  'qualified',
  'demo-scheduled',
  'demo-completed',
  'pilot-discussion',
  'pilot-approved',
  'contract-negotiation',
  'closed-won',
  'closed-lost'
] as const

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-1000',
  '1000+'
] as const

export const INDUSTRIES = [
  'technology',
  'ecommerce',
  'finance',
  'healthcare',
  'manufacturing',
  'retail',
  'consulting',
  'education',
  'real-estate',
  'logistics',
  'other'
] as const

export type LeadSource = typeof LEAD_SOURCES[number]
export type LeadStage = typeof LEAD_STAGES[number]
export type LeadStatus = typeof LEAD_STATUSES[number]
export type DealStage = typeof DEAL_STAGES[number]
export type CompanySize = typeof COMPANY_SIZES[number]
export type Industry = typeof INDUSTRIES[number]