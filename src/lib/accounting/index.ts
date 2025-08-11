/**
 * Unified Accounting Interface
 * Provides a common interface for all accounting providers (QuickBooks, Siigo)
 */

import { createQuickBooksClient, createJournalEntryFromDocument } from './quickbooks'
import { createSiigoClient, createJournalEntryFromDIAN, getColombianAccountMappings } from './siigo'

export type AccountingProvider = 'quickbooks' | 'siigo' | 'internal'

export interface AccountingJournalEntry {
  description: string
  date: string
  reference?: string
  lines: Array<{
    accountCode: string
    amount: number
    type: 'debit' | 'credit'
    description?: string
    thirdParty?: string
    costCenter?: string
  }>
}

export interface AccountingInvoice {
  customerRef: string
  date: string
  dueDate?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
    taxes?: Array<{
      type: string
      rate: number
      amount: number
    }>
  }>
  total: number
  taxAmount?: number
  reference?: string
  notes?: string
}

export interface AccountingClient {
  provider: AccountingProvider
  createJournalEntry(entry: AccountingJournalEntry): Promise<any>
  createInvoice(invoice: AccountingInvoice): Promise<any>
  getAccounts(): Promise<any[]>
  getCustomers(): Promise<any[]>
  createCustomer(customerData: any): Promise<any>
  testConnection(): Promise<boolean>
}

class QuickBooksAccountingClient implements AccountingClient {
  provider: AccountingProvider = 'quickbooks'
  private client: ReturnType<typeof createQuickBooksClient>

  constructor(companyId?: string, accessToken?: string, refreshToken?: string) {
    this.client = createQuickBooksClient(companyId, accessToken, refreshToken)
  }

  async createJournalEntry(entry: AccountingJournalEntry): Promise<any> {
    // Convert unified format to QuickBooks format
    const qbEntry = {
      description: entry.description,
      date: entry.date,
      reference: entry.reference,
      lines: entry.lines.map(line => ({
        accountRef: line.accountCode,
        amount: line.amount,
        type: line.type === 'debit' ? 'Debit' as const : 'Credit' as const,
        description: line.description
      }))
    }

    return this.client.createJournalEntry(qbEntry)
  }

  async createInvoice(invoice: AccountingInvoice): Promise<any> {
    const qbInvoice = {
      customerRef: invoice.customerRef,
      date: invoice.date,
      dueDate: invoice.dueDate,
      lines: invoice.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.total
      })),
      memo: invoice.notes,
      docNumber: invoice.reference
    }

    return this.client.createInvoice(qbInvoice)
  }

  async getAccounts(): Promise<any[]> {
    return this.client.getAccounts()
  }

  async getCustomers(): Promise<any[]> {
    return this.client.getCustomers()
  }

  async createCustomer(customerData: {
    name: string
    email?: string
    phone?: string
    companyName?: string
  }): Promise<any> {
    return this.client.createCustomer(customerData)
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection()
  }
}

class SiigoAccountingClient implements AccountingClient {
  provider: AccountingProvider = 'siigo'
  private client: ReturnType<typeof createSiigoClient>

  constructor(apiKey?: string, username?: string, password?: string) {
    this.client = createSiigoClient(apiKey, username, password)
  }

  async createJournalEntry(entry: AccountingJournalEntry): Promise<any> {
    // Convert unified format to Siigo format
    const siigoEntry = {
      date: entry.date,
      reference: entry.reference || entry.description,
      notes: entry.description,
      items: entry.lines.map(line => ({
        accountCode: line.accountCode,
        description: line.description || entry.description,
        debit: line.type === 'debit' ? line.amount : 0,
        credit: line.type === 'credit' ? line.amount : 0,
        thirdParty: line.thirdParty,
        costCenter: line.costCenter
      }))
    }

    return this.client.createJournalEntry(siigoEntry)
  }

  async createInvoice(invoice: AccountingInvoice): Promise<any> {
    const siigoInvoice = {
      customerId: invoice.customerRef,
      date: invoice.date,
      dueDate: invoice.dueDate,
      items: invoice.items.map(item => ({
        code: 'SERV001', // Default service code
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        taxes: item.taxes?.map(tax => ({
          id: tax.type === 'IVA' ? 1 : 2, // IVA = 1, other = 2
          percentage: tax.rate
        })) || []
      })),
      observations: invoice.notes
    }

    return this.client.createInvoice(siigoInvoice)
  }

  async getAccounts(): Promise<any[]> {
    return this.client.getAccounts()
  }

  async getCustomers(): Promise<any[]> {
    return this.client.getCustomers()
  }

  async createCustomer(customerData: {
    name: string
    email?: string
    phone?: string
    identification?: string
    identificationType?: string
    isVatResponsible?: boolean
  }): Promise<any> {
    return this.client.createCustomer({
      identificationType: customerData.identificationType || 'CC',
      identification: customerData.identification || '12345678',
      firstName: customerData.name.split(' ')[0],
      lastName: customerData.name.split(' ').slice(1).join(' '),
      email: customerData.email,
      phone: customerData.phone,
      isVatResponsible: customerData.isVatResponsible
    })
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection()
  }
}

class InternalAccountingClient implements AccountingClient {
  provider: AccountingProvider = 'internal'

  async createJournalEntry(entry: AccountingJournalEntry): Promise<any> {
    // For internal accounting, we just log the entry
    console.log('Internal journal entry:', entry)
    return {
      id: `INT-JE-${Date.now()}`,
      status: 'created',
      entry
    }
  }

  async createInvoice(invoice: AccountingInvoice): Promise<any> {
    console.log('Internal invoice:', invoice)
    return {
      id: `INT-INV-${Date.now()}`,
      status: 'created',
      invoice
    }
  }

  async getAccounts(): Promise<any[]> {
    return [
      { code: '1200', name: 'Accounts Receivable', type: 'Asset' },
      { code: '4000', name: 'Sales Revenue', type: 'Revenue' },
      { code: '2100', name: 'Tax Payable', type: 'Liability' }
    ]
  }

  async getCustomers(): Promise<any[]> {
    return [
      { id: 'CUST001', name: 'Default Customer', email: 'customer@example.com' }
    ]
  }

  async createCustomer(customerData: any): Promise<any> {
    return {
      id: `CUST-${Date.now()}`,
      ...customerData
    }
  }

  async testConnection(): Promise<boolean> {
    return true
  }
}

/**
 * Factory function to create accounting client based on provider
 */
export function createAccountingClient(provider: AccountingProvider): AccountingClient {
  switch (provider) {
    case 'quickbooks':
      return new QuickBooksAccountingClient(
        process.env.QBO_COMPANY_ID,
        process.env.QBO_ACCESS_TOKEN,
        process.env.QBO_REFRESH_TOKEN
      )
    
    case 'siigo':
      return new SiigoAccountingClient(
        process.env.SIIGO_API_KEY,
        process.env.SIIGO_USERNAME,
        process.env.SIIGO_PASSWORD
      )
    
    case 'internal':
    default:
      return new InternalAccountingClient()
  }
}

/**
 * Get available accounting providers based on environment configuration
 */
export function getAvailableAccountingProviders(): AccountingProvider[] {
  const providers: AccountingProvider[] = ['internal']
  
  if (process.env.QBO_COMPANY_ID && process.env.QBO_ACCESS_TOKEN) {
    providers.push('quickbooks')
  }
  
  if (process.env.SIIGO_API_KEY && process.env.SIIGO_USERNAME && process.env.SIIGO_PASSWORD) {
    providers.push('siigo')
  }
  
  return providers
}

/**
 * Test connections to all configured accounting providers
 */
export async function testAllAccountingConnections(): Promise<Record<AccountingProvider, boolean>> {
  const providers = getAvailableAccountingProviders()
  const results: Record<string, boolean> = {}
  
  for (const provider of providers) {
    try {
      const client = createAccountingClient(provider)
      results[provider] = await client.testConnection()
    } catch (error) {
      console.error(`Error testing ${provider} connection:`, error)
      results[provider] = false
    }
  }
  
  return results as Record<AccountingProvider, boolean>
}

/**
 * Helper function to create journal entry from document data
 */
export async function createJournalEntryFromDocument(
  provider: AccountingProvider,
  documentData: {
    type: 'CFDI' | 'DIAN' | 'INVOICE'
    total: number
    taxAmount?: number
    date: string
    reference?: string
    description: string
    customerIdentification?: string
    country?: string
  }
): Promise<any> {
  const client = createAccountingClient(provider)
  
  // Get appropriate account mappings based on document type and country
  const accountMappings = getAccountMappings(documentData.type, documentData.country)
  
  const journalEntry: AccountingJournalEntry = {
    description: `${documentData.type}: ${documentData.description}`,
    date: documentData.date,
    reference: documentData.reference,
    lines: []
  }

  const taxAmount = documentData.taxAmount || 0
  const netAmount = documentData.total - taxAmount

  // Debit: Accounts Receivable
  journalEntry.lines.push({
    accountCode: accountMappings.receivableAccount,
    amount: documentData.total,
    type: 'debit',
    description: 'Accounts Receivable',
    thirdParty: documentData.customerIdentification
  })

  // Credit: Revenue
  journalEntry.lines.push({
    accountCode: accountMappings.revenueAccount,
    amount: netAmount,
    type: 'credit',
    description: 'Revenue'
  })

  // Credit: Tax (if applicable)
  if (taxAmount > 0 && accountMappings.taxAccount) {
    journalEntry.lines.push({
      accountCode: accountMappings.taxAccount,
      amount: taxAmount,
      type: 'credit',
      description: 'Tax Payable'
    })
  }

  return client.createJournalEntry(journalEntry)
}

/**
 * Get account mappings based on document type and country
 */
function getAccountMappings(documentType: string, country?: string): Record<string, string> {
  // Default mappings
  const mappings: Record<string, Record<string, string>> = {
    'CFDI_MX': {
      receivableAccount: '1200', // Accounts Receivable
      revenueAccount: '4000',    // Sales Revenue
      taxAccount: '2100'         // Tax Payable
    },
    'DIAN_CO': {
      receivableAccount: '1305', // Clientes Nacionales
      revenueAccount: '4135',    // Comercio al por mayor y al por menor
      taxAccount: '2367'         // IVA por Pagar
    },
    'INVOICE_GENERIC': {
      receivableAccount: '1200', // Accounts Receivable
      revenueAccount: '4000'     // Sales Revenue
    }
  }

  const key = `${documentType}_${country || 'GENERIC'}`
  return mappings[key] || mappings['INVOICE_GENERIC']
}

// Re-export individual accounting clients for direct use
export {
  createQuickBooksClient,
  createSiigoClient
}