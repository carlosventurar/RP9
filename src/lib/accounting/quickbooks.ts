/**
 * QuickBooks Online Integration
 * Handles journal entries, invoice creation, and account management
 */

import { z } from 'zod'

const qboBaseUrl = process.env.QBO_BASE_URL || 'https://sandbox-quickbooks.api.intuit.com'
const qboClientId = process.env.QBO_CLIENT_ID
const qboClientSecret = process.env.QBO_CLIENT_SECRET
const qboAccessToken = process.env.QBO_ACCESS_TOKEN
const qboRefreshToken = process.env.QBO_REFRESH_TOKEN
const qboCompanyId = process.env.QBO_COMPANY_ID

// Validation schemas
const QBOJournalEntrySchema = z.object({
  description: z.string(),
  date: z.string(), // YYYY-MM-DD format
  lines: z.array(z.object({
    accountRef: z.string(), // Account ID
    amount: z.number(),
    type: z.enum(['Debit', 'Credit']),
    description: z.string().optional()
  })),
  reference: z.string().optional()
})

const QBOInvoiceSchema = z.object({
  customerRef: z.string(), // Customer ID
  date: z.string(),
  dueDate: z.string().optional(),
  lines: z.array(z.object({
    itemRef: z.string().optional(),
    description: z.string(),
    quantity: z.number().default(1),
    unitPrice: z.number(),
    amount: z.number()
  })),
  memo: z.string().optional(),
  docNumber: z.string().optional()
})

interface QBOJournalEntry {
  description: string
  date: string
  lines: Array<{
    accountRef: string
    amount: number
    type: 'Debit' | 'Credit'
    description?: string
  }>
  reference?: string
}

interface QBOInvoice {
  customerRef: string
  date: string
  dueDate?: string
  lines: Array<{
    itemRef?: string
    description: string
    quantity?: number
    unitPrice: number
    amount: number
  }>
  memo?: string
  docNumber?: string
}

interface QBOAccount {
  Id: string
  Name: string
  AccountType: string
  AccountSubType: string
  CurrentBalance: number
  Active: boolean
}

interface QBOCustomer {
  Id: string
  Name: string
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  Active: boolean
}

interface QBOApiResponse {
  QueryResponse?: {
    [key: string]: any[]
  }
  [key: string]: any
}

export class QuickBooksClient {
  private readonly baseUrl: string
  private readonly companyId: string
  private accessToken: string
  private refreshToken: string
  private readonly clientId: string
  private readonly clientSecret: string

  constructor(
    companyId?: string,
    accessToken?: string,
    refreshToken?: string,
    clientId?: string,
    clientSecret?: string
  ) {
    this.baseUrl = qboBaseUrl
    this.companyId = companyId || qboCompanyId || ''
    this.accessToken = accessToken || qboAccessToken || ''
    this.refreshToken = refreshToken || qboRefreshToken || ''
    this.clientId = clientId || qboClientId || ''
    this.clientSecret = clientSecret || qboClientSecret || ''

    if (!this.companyId || !this.accessToken) {
      throw new Error('QuickBooks Company ID and Access Token are required')
    }
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const url = `${this.baseUrl}/v3/company/${this.companyId}/${endpoint}`

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json'
    }

    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    })

    if (response.status === 401) {
      // Try to refresh token
      if (this.refreshToken) {
        await this.refreshAccessToken()
        // Retry the request with new token
        headers['Authorization'] = `Bearer ${this.accessToken}`
        const retryResponse = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined
        })
        
        if (!retryResponse.ok) {
          const error = await retryResponse.text()
          throw new Error(`QuickBooks API error after refresh (${retryResponse.status}): ${error}`)
        }
        
        return retryResponse.json()
      }
      throw new Error('QuickBooks access token expired and no refresh token available')
    }

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`QuickBooks API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  /**
   * Refresh the access token
   */
  private async refreshAccessToken(): Promise<void> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token refresh failed: ${error}`)
    }

    const tokenData = await response.json()
    this.accessToken = tokenData.access_token
    this.refreshToken = tokenData.refresh_token || this.refreshToken

    console.log('QuickBooks access token refreshed successfully')
  }

  /**
   * Create a journal entry
   */
  async createJournalEntry(journalEntry: QBOJournalEntry): Promise<any> {
    const validatedData = QBOJournalEntrySchema.parse(journalEntry)

    // Convert to QuickBooks format
    const qboJournalEntry = {
      Name: validatedData.description,
      TxnDate: validatedData.date,
      Line: validatedData.lines.map((line, index) => ({
        Id: (index + 1).toString(),
        DetailType: 'JournalEntryLineDetail',
        Amount: line.amount,
        JournalEntryLineDetail: {
          PostingType: line.type,
          AccountRef: { value: line.accountRef },
          ...(line.description && { Description: line.description })
        }
      })),
      ...(validatedData.reference && { DocNumber: validatedData.reference })
    }

    const result = await this.makeRequest('journalentries', 'POST', qboJournalEntry)
    return result.QueryResponse?.JournalEntry?.[0] || result
  }

  /**
   * Create an invoice
   */
  async createInvoice(invoice: QBOInvoice): Promise<any> {
    const validatedData = QBOInvoiceSchema.parse(invoice)

    const qboInvoice = {
      CustomerRef: { value: validatedData.customerRef },
      TxnDate: validatedData.date,
      ...(validatedData.dueDate && { DueDate: validatedData.dueDate }),
      Line: validatedData.lines.map((line, index) => ({
        Id: (index + 1).toString(),
        LineNum: index + 1,
        Amount: line.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: line.itemRef ? { value: line.itemRef } : undefined,
          Qty: line.quantity || 1,
          UnitPrice: line.unitPrice
        },
        Description: line.description
      })),
      ...(validatedData.memo && { PrivateNote: validatedData.memo }),
      ...(validatedData.docNumber && { DocNumber: validatedData.docNumber })
    }

    const result = await this.makeRequest('invoices', 'POST', qboInvoice)
    return result.QueryResponse?.Invoice?.[0] || result
  }

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<QBOAccount[]> {
    const result = await this.makeRequest("query?query=SELECT * FROM Account")
    return result.QueryResponse?.Account || []
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string): Promise<QBOAccount | null> {
    try {
      const result = await this.makeRequest(`accounts/${accountId}`)
      return result.QueryResponse?.Account?.[0] || null
    } catch (error) {
      console.error('Error fetching QuickBooks account:', error)
      return null
    }
  }

  /**
   * Get all customers
   */
  async getCustomers(): Promise<QBOCustomer[]> {
    const result = await this.makeRequest("query?query=SELECT * FROM Customer")
    return result.QueryResponse?.Customer || []
  }

  /**
   * Create a customer
   */
  async createCustomer(customerData: {
    name: string
    companyName?: string
    email?: string
    phone?: string
  }): Promise<QBOCustomer> {
    const customer = {
      Name: customerData.name,
      ...(customerData.companyName && { CompanyName: customerData.companyName }),
      ...(customerData.email && {
        PrimaryEmailAddr: { Address: customerData.email }
      }),
      ...(customerData.phone && {
        PrimaryPhone: { FreeFormNumber: customerData.phone }
      })
    }

    const result = await this.makeRequest('customers', 'POST', customer)
    return result.QueryResponse?.Customer?.[0] || result
  }

  /**
   * Get company information
   */
  async getCompanyInfo(): Promise<any> {
    const result = await this.makeRequest("query?query=SELECT * FROM CompanyInfo")
    return result.QueryResponse?.CompanyInfo?.[0]
  }

  /**
   * Test connection to QuickBooks API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getCompanyInfo()
      return true
    } catch (error) {
      console.error('QuickBooks connection test failed:', error)
      return false
    }
  }
}

/**
 * Factory function for creating QuickBooks client
 */
export function createQuickBooksClient(
  companyId?: string,
  accessToken?: string,
  refreshToken?: string
): QuickBooksClient {
  return new QuickBooksClient(companyId, accessToken, refreshToken)
}

/**
 * Helper function to create journal entry from CFDI/DIAN data
 */
export async function createJournalEntryFromDocument(
  client: QuickBooksClient,
  documentData: {
    type: 'CFDI' | 'DIAN' | 'INVOICE'
    total: number
    date: string
    reference?: string
    description: string
    accountMappings: {
      receivableAccount: string
      revenueAccount: string
      taxAccount?: string
    }
  }
): Promise<any> {
  const { total, date, description, accountMappings, reference } = documentData

  // Create basic journal entry for invoice recognition
  const journalEntry: QBOJournalEntry = {
    description: `${documentData.type}: ${description}`,
    date,
    reference,
    lines: [
      {
        accountRef: accountMappings.receivableAccount,
        amount: total,
        type: 'Debit',
        description: 'Accounts Receivable'
      },
      {
        accountRef: accountMappings.revenueAccount,
        amount: total,
        type: 'Credit',
        description: 'Revenue'
      }
    ]
  }

  // Add tax line if tax account is specified
  if (accountMappings.taxAccount && total > 0) {
    const taxAmount = total * 0.16 // Assuming 16% tax rate
    const netAmount = total - taxAmount

    // Adjust the lines for tax
    journalEntry.lines = [
      {
        accountRef: accountMappings.receivableAccount,
        amount: total,
        type: 'Debit',
        description: 'Accounts Receivable'
      },
      {
        accountRef: accountMappings.revenueAccount,
        amount: netAmount,
        type: 'Credit',
        description: 'Revenue (net of tax)'
      },
      {
        accountRef: accountMappings.taxAccount,
        amount: taxAmount,
        type: 'Credit',
        description: 'Tax Payable'
      }
    ]
  }

  return client.createJournalEntry(journalEntry)
}

/**
 * Get default account mappings for different document types
 */
export function getDefaultAccountMappings(documentType: string, country: string): Record<string, string> {
  // These would be configured per tenant in production
  const mappings: Record<string, Record<string, string>> = {
    'CFDI_MX': {
      receivableAccount: '1200', // Accounts Receivable
      revenueAccount: '4000',    // Sales Revenue
      taxAccount: '2100'         // Tax Payable
    },
    'DIAN_CO': {
      receivableAccount: '1305', // Accounts Receivable
      revenueAccount: '4135',    // Sales Revenue
      taxAccount: '2367'         // IVA por Pagar
    },
    'INVOICE_GENERIC': {
      receivableAccount: '1200', // Accounts Receivable
      revenueAccount: '4000'     // Sales Revenue
    }
  }

  const key = `${documentType}_${country}` 
  return mappings[key] || mappings['INVOICE_GENERIC']
}