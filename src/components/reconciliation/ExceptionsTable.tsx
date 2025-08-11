'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  AlertTriangle,
  Download,
  Eye,
  CheckCircle,
  X,
  Loader2
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'

interface ReconciliationException {
  id: string
  transaction_data: {
    id: string
    date: string
    description: string
    amount: number
    reference?: string
    type: 'debit' | 'credit'
  }
  exception_reason: string
  suggestions: string[]
  status: 'needs_review' | 'resolved' | 'ignored'
  created_at: string
  reconciliation_run_id: string
}

interface ExceptionsTableProps {
  runId?: string
  showAll?: boolean
}

export default function ExceptionsTable({ runId, showAll = false }: ExceptionsTableProps) {
  const [exceptions, setExceptions] = useState<ReconciliationException[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadExceptions()
  }, [runId, showAll])

  async function loadExceptions() {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('No authentication session')
        return
      }

      // Get tenant ID
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user_id', session.user.id)
        .single()

      if (!tenant) {
        setError('Tenant not found')
        return
      }

      let query = supabase
        .from('reconciliation_exceptions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })

      if (runId && !showAll) {
        query = query.eq('reconciliation_run_id', runId)
      }

      if (!showAll) {
        query = query.eq('status', 'needs_review').limit(50)
      } else {
        query = query.limit(200)
      }

      const { data: exceptionsData, error: exceptionsError } = await query

      if (exceptionsError) {
        throw new Error(exceptionsError.message)
      }

      setExceptions(exceptionsData || [])
      
    } catch (error) {
      console.error('Error loading exceptions:', error)
      setError(error instanceof Error ? error.message : 'Failed to load exceptions')
    } finally {
      setLoading(false)
    }
  }

  async function updateExceptionStatus(exceptionId: string, status: 'resolved' | 'ignored', notes?: string) {
    setProcessingId(exceptionId)
    
    try {
      const { error } = await supabase
        .from('reconciliation_exceptions')
        .update({
          status,
          resolution_notes: notes,
          resolved_at: new Date().toISOString()
        })
        .eq('id', exceptionId)

      if (error) {
        throw new Error(error.message)
      }

      // Update local state
      setExceptions(prev => prev.map(exc => 
        exc.id === exceptionId 
          ? { ...exc, status, resolution_notes: notes }
          : exc
      ))

    } catch (error) {
      console.error('Error updating exception:', error)
      alert(`Failed to update exception: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setProcessingId(null)
    }
  }

  function exportExceptionsCSV() {
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Reference', 'Reason', 'Status']
    const rows = exceptions.map(exc => [
      exc.transaction_data.date,
      exc.transaction_data.description,
      exc.transaction_data.amount.toString(),
      exc.transaction_data.type,
      exc.transaction_data.reference || '',
      exc.exception_reason,
      exc.status
    ])

    const csvContent = [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reconciliation-exceptions-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function formatAmount(amount: number, type: 'debit' | 'credit'): string {
    const formatted = Math.abs(amount).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    })
    return type === 'debit' ? `-${formatted}` : formatted
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'needs_review':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Needs Review</Badge>
      case 'resolved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>
      case 'ignored':
        return <Badge variant="secondary"><X className="h-3 w-3 mr-1" />Ignored</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Reconciliation Exceptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Reconciliation Exceptions
            </CardTitle>
            <CardDescription>
              Transactions that require manual review
            </CardDescription>
          </div>
          
          {exceptions.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportExceptionsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadExceptions} variant="outline">
              Retry
            </Button>
          </div>
        ) : exceptions.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
            <p className="text-muted-foreground mb-2">No exceptions found</p>
            <p className="text-sm text-muted-foreground">
              All transactions have been successfully matched!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {exceptions.map((exception) => (
              <div 
                key={exception.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {exception.transaction_data.description}
                      </h4>
                      {getStatusBadge(exception.status)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatDate(exception.transaction_data.date)}</span>
                      <span className={
                        exception.transaction_data.type === 'debit' 
                          ? 'text-red-600 font-medium' 
                          : 'text-green-600 font-medium'
                      }>
                        {formatAmount(exception.transaction_data.amount, exception.transaction_data.type)}
                      </span>
                      {exception.transaction_data.reference && (
                        <span>Ref: {exception.transaction_data.reference}</span>
                      )}
                    </div>
                    
                    <div className="text-sm">
                      <strong className="text-destructive">Issue:</strong> {exception.exception_reason}
                    </div>
                    
                    {exception.suggestions.length > 0 && (
                      <div className="text-sm">
                        <strong>Suggestions:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {exception.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-muted-foreground">
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  {exception.status === 'needs_review' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateExceptionStatus(exception.id, 'resolved', 'Manually resolved')}
                        disabled={processingId === exception.id}
                      >
                        {processingId === exception.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateExceptionStatus(exception.id, 'ignored', 'Manually ignored')}
                        disabled={processingId === exception.id}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}