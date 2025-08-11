/**
 * Siigo ERP Integration (Colombia)
 * Handles invoice creation, journal entries, and financial reporting for Colombian market
 */

import { z } from 'zod'

const siigoBaseUrl = process.env.SIIGO_BASE_URL || 'https://api.siigo.com'
const siigoApiKey = process.env.SIIGO_API_KEY
const siigoUsername = process.env.SIIGO_USERNAME
const siigoPassword = process.env.SIIGO_PASSWORD

// Validation schemas
const SiigoInvoiceSchema = z.object({
  customerId: z.string(),
  date: z.string(), // YYYY-MM-DD
  dueDate: z.string().optional(),
  items: z.array(z.object({
    code: z.string(),
    description: z.string(),
    quantity: z.number().default(1),
    price: z.number(),
    discount: z.number().default(0),
    taxes: z.array(z.object({
      id: z.number(), // Tax type ID
      percentage: z.number()
    })).default([])
  })),
  observations: z.string().optional(),
  metadata: z.array(z.object({
    name: z.string(),
    value: z.string()
  })).optional()
})

const SiigoJournalEntrySchema = z.object({
  date: z.string(),
  reference: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    accountCode: z.string(),
    description: z.string(),
    debit: z.number().default(0),
    credit: z.number().default(0),
    thirdParty: z.string().optional(), // Customer/Supplier ID
    costCenter: z.string().optional(),
    metadata: z.array(z.object({
      name: z.string(),
      value: z.string()
    })).optional()
  }))
})

interface SiigoInvoice {
  customerId: string
  date: string
  dueDate?: string
  items: Array<{
    code: string
    description: string
    quantity?: number
    price: number
    discount?: number
    taxes?: Array<{
      id: number
      percentage: number
    }>
  }>
  observations?: string
  metadata?: Array<{
    name: string
    value: string
  }>
}

interface SiigoJournalEntry {
  date: string
  reference: string
  notes?: string
  items: Array<{
    accountCode: string
    description: string
    debit?: number
    credit?: number
    thirdParty?: string
    costCenter?: string
    metadata?: Array<{
      name: string
      value: string
    }>
  }>
}

interface SiigoCustomer {
  id: string
  type: 'Customer' | 'Supplier' | 'Other'
  person_type: 'Person' | 'Company'
  id_type: string
  identification: string
  name: Array<{
    first_name?: string
    last_name?: string
    other_names?: string
    surname?: string
  }>
  commercial_name?: string
  active: boolean
  vat_responsible: boolean
}

interface SiigoAccount {
  code: string
  name: string
  type: string
  level: number
  active: boolean
  movement: boolean
}

export class SiigoClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly username: string
  private readonly password: string
  private accessToken?: string
  private tokenExpiresAt?: Date

  constructor(apiKey?: string, username?: string, password?: string) {
    this.baseUrl = siigoBaseUrl
    this.apiKey = apiKey || siigoApiKey || ''
    this.username = username || siigoUsername || ''
    this.password = password || siigoPassword || ''

    if (!this.apiKey || !this.username || !this.password) {
      throw new Error('Siigo API credentials are required')
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return // Token is still valid
    }

    await this.authenticate()
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Partner-Id': this.apiKey
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Siigo authentication failed: ${error}`)
    }

    const authData = await response.json()
    this.accessToken = authData.access_token
    
    // Set expiration (tokens typically last 1 hour)
    this.tokenExpiresAt = new Date(Date.now() + (authData.expires_in - 300) * 1000) // 5 min buffer
    
    console.log('Siigo authentication successful')
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    await this.ensureAuthenticated()

    const url = `${this.baseUrl}/v1/${endpoint}`
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Partner-Id': this.apiKey
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Siigo API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Create an invoice
   */
  async createInvoice(invoice: SiigoInvoice): Promise<any> {
    const validatedData = SiigoInvoiceSchema.parse(invoice)

    const siigoInvoice = {
      document: {
        id: 24 // Standard invoice type ID for Siigo
      },
      date: validatedData.date,
      ...(validatedData.dueDate && { due_date: validatedData.dueDate }),
      customer: {
        identification: validatedData.customerId
      },
      items: validatedData.items.map(item => ({
        code: item.code,
        description: item.description,
        quantity: item.quantity || 1,
        price: item.price,
        discount: item.discount || 0,
        taxes: item.taxes || []
      })),
      ...(validatedData.observations && { observations: validatedData.observations }),
      ...(validatedData.metadata && { metadata: validatedData.metadata })
    }

    return this.makeRequest('invoices', 'POST', siigoInvoice)
  }

  /**
   * Create a journal entry (accounting entry)
   */
  async createJournalEntry(journalEntry: SiigoJournalEntry): Promise<any> {
    const validatedData = SiigoJournalEntrySchema.parse(journalEntry)

    const siigoJournalEntry = {
      document: {
        id: 29 // Standard journal entry type ID
      },
      date: validatedData.date,
      reference: validatedData.reference,
      ...(validatedData.notes && { notes: validatedData.notes }),
      items: validatedData.items.map(item => ({
        account: {
          code: item.accountCode
        },
        description: item.description,
        debit: item.debit || 0,
        credit: item.credit || 0,
        ...(item.thirdParty && { third_party: { identification: item.thirdParty } }),
        ...(item.costCenter && { cost_center: { code: item.costCenter } }),
        ...(item.metadata && { metadata: item.metadata })
      }))
    }

    return this.makeRequest('journal-entries', 'POST', siigoJournalEntry)
  }

  /**
   * Get all customers
   */
  async getCustomers(): Promise<SiigoCustomer[]> {
    const result = await this.makeRequest('customers')
    return result.results || []
  }

  /**
   * Create a customer
   */
  async createCustomer(customerData: {
    identificationType: string // 'CC', 'NIT', etc.
    identification: string
    firstName?: string
    lastName?: string
    commercialName?: string
    email?: string
    phone?: string
    address?: string
    isVatResponsible?: boolean
  }): Promise<SiigoCustomer> {
    const customer = {
      type: 'Customer',
      person_type: customerData.commercialName ? 'Company' : 'Person',
      id_type: customerData.identificationType,
      identification: customerData.identification,
      name: [{
        first_name: customerData.firstName,
        last_name: customerData.lastName
      }],
      ...(customerData.commercialName && { commercial_name: customerData.commercialName }),
      vat_responsible: customerData.isVatResponsible || false,
      active: true,
      contacts: customerData.email || customerData.phone ? [{
        ...(customerData.email && { email: customerData.email }),
        ...(customerData.phone && { phone: { number: customerData.phone } })
      }] : [],
      ...(customerData.address && {
        address: {
          address: customerData.address
        }
      })
    }

    return this.makeRequest('customers', 'POST', customer)
  }

  /**
   * Get chart of accounts
   */
  async getAccounts(): Promise<SiigoAccount[]> {
    const result = await this.makeRequest('accounts')
    return result.results || []
  }

  /**
   * Get account by code
   */
  async getAccount(accountCode: string): Promise<SiigoAccount | null> {
    try {
      return await this.makeRequest(`accounts/${accountCode}`)
    } catch (error) {
      console.error('Error fetching Siigo account:', error)
      return null
    }
  }

  /**
   * Get tax types
   */
  async getTaxTypes(): Promise<any[]> {
    const result = await this.makeRequest('taxes')
    return result.results || []
  }

  /**
   * Get company information
   */
  async getCompanyInfo(): Promise<any> {
    return this.makeRequest('users/me')
  }

  /**
   * Test connection to Siigo API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getCompanyInfo()
      return true
    } catch (error) {
      console.error('Siigo connection test failed:', error)
      return false
    }
  }
}

/**
 * Factory function for creating Siigo client
 */
export function createSiigoClient(
  apiKey?: string,
  username?: string,
  password?: string
): SiigoClient {
  return new SiigoClient(apiKey, username, password)
}

/**
 * Helper function to create journal entry from DIAN document
 */
export async function createJournalEntryFromDIAN(
  client: SiigoClient,
  dianData: {
    invoiceNumber: string
    total: number
    taxAmount?: number
    date: string
    customerIdentification?: string
    description: string
    accountMappings: {
      receivableAccount: string
      revenueAccount: string
      taxAccount?: string
      costCenter?: string
    }
  }
): Promise<any> {
  const { total, taxAmount = 0, date, description, accountMappings, invoiceNumber } = dianData
  const netAmount = total - taxAmount

  const journalEntryItems = [
    {
      accountCode: accountMappings.receivableAccount,
      description: `Factura ${invoiceNumber} - CxC`,
      debit: total,
      credit: 0,
      thirdParty: dianData.customerIdentification,
      costCenter: accountMappings.costCenter
    },
    {
      accountCode: accountMappings.revenueAccount,
      description: `Factura ${invoiceNumber} - Ingresos`,
      debit: 0,
      credit: netAmount,
      costCenter: accountMappings.costCenter
    }
  ]

  // Add tax entry if applicable
  if (taxAmount > 0 && accountMappings.taxAccount) {
    journalEntryItems.push({
      accountCode: accountMappings.taxAccount,
      description: `Factura ${invoiceNumber} - IVA`,
      debit: 0,
      credit: taxAmount,
      costCenter: accountMappings.costCenter
    })
  }

  const journalEntry: SiigoJournalEntry = {
    date,
    reference: invoiceNumber,
    notes: `Registro automático - ${description}`,
    items: journalEntryItems
  }

  return client.createJournalEntry(journalEntry)
}

/**
 * Get default Colombian account mappings
 */
export function getColombianAccountMappings(): Record<string, string> {
  return {
    receivableAccount: '1305', // Clientes Nacionales
    revenueAccount: '4135',    // Comercio al por mayor y al por menor
    taxAccount: '2367',        // IVA por pagar
    costCenter: '001'          // Default cost center
  }
}

/**
 * Helper to validate Colombian tax identification
 */
export function validateColombianNIT(nit: string): boolean {
  // Remove dots and dashes
  const cleanNIT = nit.replace(/[.-]/g, '')
  
  // Must be numeric and between 8-15 digits
  if (!/^\d{8,15}$/.test(cleanNIT)) {
    return false
  }
  
  // Calculate verification digit (simplified)
  const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]
  let sum = 0
  
  for (let i = 0; i < cleanNIT.length - 1; i++) {
    const digit = parseInt(cleanNIT[cleanNIT.length - 2 - i])
    sum += digit * weights[i]
  }
  
  const remainder = sum % 11
  const verificationDigit = remainder < 2 ? remainder : 11 - remainder
  const providedDigit = parseInt(cleanNIT[cleanNIT.length - 1])
  
  return verificationDigit === providedDigit
}