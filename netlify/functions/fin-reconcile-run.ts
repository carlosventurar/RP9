import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByTenant, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '../../src/lib/security/rate-limit'
import { z } from 'zod'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const belvoApiUrl = process.env.BELVO_API_URL || 'https://api.belvo.com'
const belvoSecretId = process.env.BELVO_SECRET_ID
const belvoSecretPassword = process.env.BELVO_SECRET_PASSWORD

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Request validation schema
const ReconciliationRequestSchema = z.object({
  tenantId: z.string(),
  source: z.enum(['belvo', 'csv', 'manual']),
  sourceData: z.union([
    // Belvo source
    z.object({
      linkId: z.string(),
      accountId: z.string(),
      dateFrom: z.string(),
      dateTo: z.string().optional()
    }),
    // CSV source  
    z.object({
      csvData: z.string(), // Base64 encoded CSV
      mapping: z.object({
        dateColumn: z.string(),
        descriptionColumn: z.string(),
        amountColumn: z.string(),
        referenceColumn: z.string().optional(),
        typeColumn: z.string().optional()
      })
    }),
    // Manual transactions
    z.array(z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      reference: z.string().optional(),
      type: z.enum(['debit', 'credit']).optional()
    }))
  ]),
  options: z.object({
    autoApprove: z.boolean().default(false),
    confidenceThreshold: z.number().min(0).max(1).default(0.8)
  }).optional()
})

interface BankTransaction {
  id: string
  date: string
  description: string
  amount: number
  reference?: string
  type: 'debit' | 'credit'
  balance?: number
  metadata?: Record<string, any>
}

interface ReconciliationMatch {
  transactionId: string
  ruleId: string
  confidence: number
  matchType: 'exact' | 'fuzzy' | 'rule_based'
  matchedFields: string[]
  suggestedAccount?: string
  suggestedDescription?: string
}

interface ReconciliationResult {
  totalTransactions: number
  matchedTransactions: number
  unmatchedTransactions: number
  exceptions: Array<{
    transaction: BankTransaction
    reason: string
    suggestions?: string[]
  }>
  matches: ReconciliationMatch[]
  summary: {
    totalAmount: number
    matchedAmount: number
    unmatchedAmount: number
    confidenceDistribution: Record<string, number>
  }
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    if (!supabase) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Service configuration error' })
      }
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' })
      }
    }

    // Get user from JWT token
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization required' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      }
    }

    // Validate request
    const request = ReconciliationRequestSchema.parse(JSON.parse(event.body))
    
    // Rate limiting by tenant
    const rateLimitResult = rateLimitByTenant(request.tenantId, {
      windowMs: 60000,
      maxRequests: 10 // Limit reconciliation runs to prevent abuse
    })
    
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          remaining: rateLimitResult.remaining 
        })
      }
    }

    console.log(`Processing reconciliation for tenant ${request.tenantId}, source: ${request.source}`)

    // Get bank transactions based on source
    let transactions: BankTransaction[] = []
    
    switch (request.source) {
      case 'belvo':
        transactions = await fetchBelvoTransactions(request.sourceData as any)
        break
      case 'csv':
        transactions = await parseCSVTransactions(request.sourceData as any)
        break
      case 'manual':
        transactions = (request.sourceData as any[]).map((tx: any, index: number) => ({
          id: `manual_${Date.now()}_${index}`,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          reference: tx.reference,
          type: tx.type || (tx.amount > 0 ? 'credit' : 'debit')
        }))
        break
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid source type' })
        }
    }

    if (transactions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No transactions found' })
      }
    }

    // Run reconciliation
    const result = await runReconciliation(request.tenantId, transactions, request.options)
    
    // Store reconciliation run
    const { data: reconciliationRun, error: runError } = await supabase
      .from('reconciliation_runs')
      .insert({
        tenant_id: request.tenantId,
        source: request.source,
        total_transactions: result.totalTransactions,
        matched_transactions: result.matchedTransactions,
        unmatched_transactions: result.unmatchedTransactions,
        total_amount: result.summary.totalAmount,
        matched_amount: result.summary.matchedAmount,
        confidence_threshold: request.options?.confidenceThreshold || 0.8,
        auto_approved: request.options?.autoApprove || false,
        source_metadata: {
          sourceData: request.source === 'belvo' ? { accountId: (request.sourceData as any).accountId } : {},
          options: request.options
        },
        created_by: user.id
      })
      .select()
      .single()

    if (runError) {
      console.error('Error creating reconciliation run:', runError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create reconciliation run' })
      }
    }

    // Store matches and exceptions
    if (result.matches.length > 0) {
      const matchRecords = result.matches.map(match => ({
        tenant_id: request.tenantId,
        reconciliation_run_id: reconciliationRun.id,
        transaction_id: match.transactionId,
        rule_id: match.ruleId,
        status: request.options?.autoApprove && match.confidence >= (request.options.confidenceThreshold || 0.8) 
          ? 'matched' 
          : 'pending_review',
        confidence_score: match.confidence,
        match_type: match.matchType,
        matched_fields: match.matchedFields,
        suggested_account: match.suggestedAccount,
        suggested_description: match.suggestedDescription
      }))

      await supabase
        .from('reconciliation_matches')
        .insert(matchRecords)
    }

    // Store exceptions for manual review
    if (result.exceptions.length > 0) {
      const exceptionRecords = result.exceptions.map(exception => ({
        tenant_id: request.tenantId,
        reconciliation_run_id: reconciliationRun.id,
        transaction_data: exception.transaction,
        exception_reason: exception.reason,
        suggestions: exception.suggestions || [],
        status: 'needs_review'
      }))

      await supabase
        .from('reconciliation_exceptions')
        .insert(exceptionRecords)
    }

    return {
      statusCode: 200,
      headers: { ...headers, ...getRateLimitHeaders(rateLimitResult) },
      body: JSON.stringify({
        success: true,
        runId: reconciliationRun.id,
        result: {
          totalTransactions: result.totalTransactions,
          matchedTransactions: result.matchedTransactions,
          unmatchedTransactions: result.unmatchedTransactions,
          exceptionsCount: result.exceptions.length,
          summary: result.summary
        },
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Reconciliation error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Fetch transactions from Belvo API
 */
async function fetchBelvoTransactions(sourceData: {
  linkId: string
  accountId: string
  dateFrom: string
  dateTo?: string
}): Promise<BankTransaction[]> {
  if (!belvoSecretId || !belvoSecretPassword) {
    throw new Error('Belvo credentials not configured')
  }

  try {
    // Authenticate with Belvo
    const authResponse = await fetch(`${belvoApiUrl}/api/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secret_id: belvoSecretId,
        secret_password: belvoSecretPassword
      })
    })

    if (!authResponse.ok) {
      throw new Error('Belvo authentication failed')
    }

    const authData = await authResponse.json()
    const accessToken = authData.access_token

    // Fetch transactions
    const transactionsResponse = await fetch(`${belvoApiUrl}/api/transactions/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        link: sourceData.linkId,
        account: sourceData.accountId,
        date_from: sourceData.dateFrom,
        date_to: sourceData.dateTo || new Date().toISOString().split('T')[0]
      })
    })

    if (!transactionsResponse.ok) {
      throw new Error('Failed to fetch transactions from Belvo')
    }

    const transactions = await transactionsResponse.json()
    
    return transactions.results?.map((tx: any, index: number) => ({
      id: tx.id || `belvo_${index}`,
      date: tx.accounting_date || tx.value_date,
      description: tx.description || tx.reference,
      amount: parseFloat(tx.amount),
      reference: tx.reference,
      type: parseFloat(tx.amount) >= 0 ? 'credit' : 'debit',
      balance: tx.balance ? parseFloat(tx.balance) : undefined,
      metadata: {
        category: tx.category,
        subcategory: tx.subcategory,
        currency: tx.currency,
        belvoId: tx.id
      }
    })) || []

  } catch (error) {
    console.error('Belvo API error:', error)
    throw new Error(`Failed to fetch Belvo transactions: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse CSV transactions
 */
async function parseCSVTransactions(sourceData: {
  csvData: string
  mapping: {
    dateColumn: string
    descriptionColumn: string
    amountColumn: string
    referenceColumn?: string
    typeColumn?: string
  }
}): Promise<BankTransaction[]> {
  try {
    const csvContent = Buffer.from(sourceData.csvData, 'base64').toString('utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      throw new Error('CSV must have at least header and one data row')
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const mapping = sourceData.mapping
    
    // Find column indices
    const dateIndex = headers.findIndex(h => h.toLowerCase() === mapping.dateColumn.toLowerCase())
    const descIndex = headers.findIndex(h => h.toLowerCase() === mapping.descriptionColumn.toLowerCase())
    const amountIndex = headers.findIndex(h => h.toLowerCase() === mapping.amountColumn.toLowerCase())
    const refIndex = mapping.referenceColumn ? headers.findIndex(h => h.toLowerCase() === mapping.referenceColumn!.toLowerCase()) : -1
    const typeIndex = mapping.typeColumn ? headers.findIndex(h => h.toLowerCase() === mapping.typeColumn!.toLowerCase()) : -1

    if (dateIndex === -1 || descIndex === -1 || amountIndex === -1) {
      throw new Error('Required columns not found in CSV')
    }

    const transactions: BankTransaction[] = []

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''))
      
      if (row.length < headers.length) continue

      const amount = parseFloat(row[amountIndex])
      if (isNaN(amount)) continue

      transactions.push({
        id: `csv_${i}_${Date.now()}`,
        date: row[dateIndex],
        description: row[descIndex],
        amount,
        reference: refIndex >= 0 ? row[refIndex] : undefined,
        type: typeIndex >= 0 ? 
          (row[typeIndex].toLowerCase().includes('credit') ? 'credit' : 'debit') :
          (amount >= 0 ? 'credit' : 'debit'),
        metadata: {
          source: 'csv',
          rowIndex: i
        }
      })
    }

    return transactions

  } catch (error) {
    throw new Error(`CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Run reconciliation against rules
 */
async function runReconciliation(
  tenantId: string,
  transactions: BankTransaction[],
  options?: { autoApprove?: boolean; confidenceThreshold?: number }
): Promise<ReconciliationResult> {
  
  if (!supabase) {
    throw new Error('Supabase not initialized')
  }

  // Get reconciliation rules for tenant
  const { data: rules, error: rulesError } = await supabase
    .from('reconciliation_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('priority', { ascending: false })

  if (rulesError) {
    console.error('Error fetching reconciliation rules:', rulesError)
    throw new Error('Failed to fetch reconciliation rules')
  }

  const reconciliationRules = rules || []
  
  const matches: ReconciliationMatch[] = []
  const exceptions: Array<{ transaction: BankTransaction; reason: string; suggestions?: string[] }> = []
  
  let totalAmount = 0
  let matchedAmount = 0
  const confidenceDistribution: Record<string, number> = { high: 0, medium: 0, low: 0 }

  for (const transaction of transactions) {
    totalAmount += Math.abs(transaction.amount)
    
    let bestMatch: ReconciliationMatch | null = null
    let bestConfidence = 0

    // Try to match against each rule
    for (const rule of reconciliationRules) {
      const match = evaluateRule(rule, transaction)
      if (match && match.confidence > bestConfidence) {
        bestMatch = match
        bestConfidence = match.confidence
      }
    }

    if (bestMatch && bestConfidence >= (options?.confidenceThreshold || 0.8)) {
      matches.push(bestMatch)
      matchedAmount += Math.abs(transaction.amount)
      
      // Categorize confidence
      if (bestConfidence >= 0.9) confidenceDistribution.high++
      else if (bestConfidence >= 0.7) confidenceDistribution.medium++
      else confidenceDistribution.low++
      
    } else {
      // Create exception
      exceptions.push({
        transaction,
        reason: bestMatch ? 'Low confidence match' : 'No matching rule found',
        suggestions: bestMatch ? [`Possible match with rule ${bestMatch.ruleId} (${Math.round(bestConfidence * 100)}% confidence)`] : []
      })
    }
  }

  return {
    totalTransactions: transactions.length,
    matchedTransactions: matches.length,
    unmatchedTransactions: exceptions.length,
    exceptions,
    matches,
    summary: {
      totalAmount,
      matchedAmount,
      unmatchedAmount: totalAmount - matchedAmount,
      confidenceDistribution
    }
  }
}

/**
 * Evaluate a reconciliation rule against a transaction
 */
function evaluateRule(rule: any, transaction: BankTransaction): ReconciliationMatch | null {
  const matcher = rule.matcher
  let confidence = 0
  const matchedFields: string[] = []

  // Amount matching
  if (matcher.amount_min !== undefined || matcher.amount_max !== undefined) {
    const amount = Math.abs(transaction.amount)
    const amountMatches = 
      (matcher.amount_min === undefined || amount >= matcher.amount_min) &&
      (matcher.amount_max === undefined || amount <= matcher.amount_max)
    
    if (amountMatches) {
      confidence += 0.3
      matchedFields.push('amount')
    } else {
      return null // Amount is a hard requirement
    }
  }

  // Description matching
  if (matcher.description_contains) {
    const searchTerms = Array.isArray(matcher.description_contains) 
      ? matcher.description_contains 
      : [matcher.description_contains]
    
    const descriptionLower = transaction.description.toLowerCase()
    const matchingTerms = searchTerms.filter((term: string) => 
      descriptionLower.includes(term.toLowerCase())
    )
    
    if (matchingTerms.length > 0) {
      confidence += 0.4 * (matchingTerms.length / searchTerms.length)
      matchedFields.push('description')
    }
  }

  // Reference matching
  if (matcher.reference_pattern && transaction.reference) {
    try {
      const regex = new RegExp(matcher.reference_pattern, 'i')
      if (regex.test(transaction.reference)) {
        confidence += 0.2
        matchedFields.push('reference')
      }
    } catch (error) {
      console.warn('Invalid regex pattern in rule:', matcher.reference_pattern)
    }
  }

  // Date range matching
  if (matcher.date_range) {
    const transactionDate = new Date(transaction.date)
    const dayOfMonth = transactionDate.getDate()
    const dayOfWeek = transactionDate.getDay()
    
    if (matcher.date_range.day_of_month && matcher.date_range.day_of_month.includes(dayOfMonth)) {
      confidence += 0.1
      matchedFields.push('date')
    }
    
    if (matcher.date_range.day_of_week && matcher.date_range.day_of_week.includes(dayOfWeek)) {
      confidence += 0.1
      matchedFields.push('date')
    }
  }

  // Type matching
  if (matcher.transaction_type && matcher.transaction_type === transaction.type) {
    confidence += 0.1
    matchedFields.push('type')
  }

  // Minimum confidence threshold
  if (confidence < 0.3) {
    return null
  }

  return {
    transactionId: transaction.id,
    ruleId: rule.id,
    confidence: Math.min(confidence, 1.0),
    matchType: confidence >= 0.95 ? 'exact' : confidence >= 0.7 ? 'fuzzy' : 'rule_based',
    matchedFields,
    suggestedAccount: rule.target_account,
    suggestedDescription: rule.suggested_description || transaction.description
  }
}