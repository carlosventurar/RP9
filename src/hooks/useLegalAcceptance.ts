'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

interface LegalAcceptance {
  id: string
  document_type: string
  document_version: string
  language: string
  accepted_at: string
  ip_address: string
}

interface LegalDocument {
  id: string
  document_type: string
  version: string
  language: string
  title: string
  effective_date: string
  requires_signature: boolean
}

interface UseLegalAcceptanceOptions {
  documentType?: 'tos' | 'privacy' | 'dpa' | 'msa'
  language?: string
  autoCheck?: boolean
}

interface UseLegalAcceptanceReturn {
  // State
  hasAcceptedLatest: boolean | null
  isRequired: boolean
  latestDocument: LegalDocument | null
  userAcceptance: LegalAcceptance | null
  isLoading: boolean
  error: string | null
  
  // Actions
  checkAcceptance: () => Promise<void>
  acceptDocument: (documentType: string, version: string, language: string) => Promise<boolean>
  getRequiredAcceptances: () => Promise<LegalDocument[]>
  refreshAcceptanceStatus: () => Promise<void>
}

export function useLegalAcceptance(options: UseLegalAcceptanceOptions = {}): UseLegalAcceptanceReturn {
  const {
    documentType,
    language = 'es',
    autoCheck = true
  } = options

  const { user, tenant } = useAuth()
  const supabase = createClient()

  // State
  const [hasAcceptedLatest, setHasAcceptedLatest] = useState<boolean | null>(null)
  const [isRequired, setIsRequired] = useState(false)
  const [latestDocument, setLatestDocument] = useState<LegalDocument | null>(null)
  const [userAcceptance, setUserAcceptance] = useState<LegalAcceptance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get latest document version
  const getLatestDocument = useCallback(async (docType: string, lang: string): Promise<LegalDocument | null> => {
    try {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('document_type', docType)
        .eq('language', lang)
        .eq('status', 'active')
        .order('effective_date', { ascending: false })
        .limit(1)

      if (error) throw error
      return data?.[0] || null
    } catch (err) {
      console.error('Error getting latest document:', err)
      return null
    }
  }, [supabase])

  // Get user's acceptance for specific document
  const getUserAcceptance = useCallback(async (
    userId: string, 
    tenantId: string, 
    docType: string, 
    version: string, 
    lang: string
  ): Promise<LegalAcceptance | null> => {
    try {
      const { data, error } = await supabase
        .from('legal_acceptances')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('document_type', docType)
        .eq('document_version', version)
        .eq('language', lang)
        .order('accepted_at', { ascending: false })
        .limit(1)

      if (error) throw error
      return data?.[0] || null
    } catch (err) {
      console.error('Error getting user acceptance:', err)
      return null
    }
  }, [supabase])

  // Check if user has accepted latest version
  const checkAcceptance = useCallback(async () => {
    if (!user || !tenant || !documentType) {
      setHasAcceptedLatest(null)
      setIsRequired(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get latest document
      const latest = await getLatestDocument(documentType, language)
      setLatestDocument(latest)

      if (!latest) {
        setHasAcceptedLatest(null)
        setIsRequired(false)
        return
      }

      // Check if user has accepted this version
      const acceptance = await getUserAcceptance(
        user.id,
        tenant.id,
        documentType,
        latest.version,
        language
      )

      setUserAcceptance(acceptance)
      setHasAcceptedLatest(!!acceptance)
      setIsRequired(!acceptance && latest.requires_signature)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error checking acceptance')
      setHasAcceptedLatest(null)
    } finally {
      setIsLoading(false)
    }
  }, [user, tenant, documentType, language, getLatestDocument, getUserAcceptance])

  // Accept a document
  const acceptDocument = useCallback(async (
    docType: string, 
    version: string, 
    lang: string
  ): Promise<boolean> => {
    if (!user || !tenant) {
      setError('User not authenticated')
      return false
    }

    try {
      const response = await fetch('/.netlify/functions/legal-accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_type: docType,
          version: version,
          tenant_id: tenant.id,
          user_id: user.id,
          language: lang
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to accept document')
      }

      // Update local state
      setUserAcceptance({
        id: result.data.acceptance_id,
        document_type: docType,
        document_version: version,
        language: lang,
        accepted_at: result.data.accepted_at,
        ip_address: result.data.ip_address
      })

      setHasAcceptedLatest(true)
      setIsRequired(false)

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept document')
      return false
    }
  }, [user, tenant])

  // Get all required acceptances for current user
  const getRequiredAcceptances = useCallback(async (): Promise<LegalDocument[]> => {
    if (!user || !tenant) return []

    try {
      // Get all active documents that require acceptance
      const { data: documents, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('status', 'active')
        .eq('requires_signature', true)
        .order('document_type', { ascending: true })
        .order('effective_date', { ascending: false })

      if (error) throw error

      // Group by document_type and language, keeping only latest version
      const latestDocs = new Map<string, LegalDocument>()
      
      documents?.forEach(doc => {
        const key = `${doc.document_type}_${doc.language}`
        if (!latestDocs.has(key) || new Date(doc.effective_date) > new Date(latestDocs.get(key)!.effective_date)) {
          latestDocs.set(key, doc)
        }
      })

      // Filter out documents the user has already accepted
      const required: LegalDocument[] = []
      
      for (const doc of latestDocs.values()) {
        const acceptance = await getUserAcceptance(
          user.id,
          tenant.id,
          doc.document_type,
          doc.version,
          doc.language
        )
        
        if (!acceptance) {
          required.push(doc)
        }
      }

      return required
    } catch (err) {
      console.error('Error getting required acceptances:', err)
      return []
    }
  }, [user, tenant, getUserAcceptance, supabase])

  // Refresh acceptance status
  const refreshAcceptanceStatus = useCallback(async () => {
    if (documentType) {
      await checkAcceptance()
    }
  }, [checkAcceptance, documentType])

  // Auto-check on mount and dependency changes
  useEffect(() => {
    if (autoCheck && documentType) {
      checkAcceptance()
    }
  }, [autoCheck, documentType, language, user, tenant, checkAcceptance])

  return {
    // State
    hasAcceptedLatest,
    isRequired,
    latestDocument,
    userAcceptance,
    isLoading,
    error,
    
    // Actions
    checkAcceptance,
    acceptDocument,
    getRequiredAcceptances,
    refreshAcceptanceStatus
  }
}

// Helper hook for checking if user has all required acceptances
export function useRequiredAcceptances() {
  const { user, tenant } = useAuth()
  const [requiredDocs, setRequiredDocs] = useState<LegalDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasAllRequired, setHasAllRequired] = useState(true)

  const { getRequiredAcceptances } = useLegalAcceptance({ autoCheck: false })

  const checkAllRequired = useCallback(async () => {
    if (!user || !tenant) return

    setIsLoading(true)
    try {
      const required = await getRequiredAcceptances()
      setRequiredDocs(required)
      setHasAllRequired(required.length === 0)
    } catch (err) {
      console.error('Error checking required acceptances:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user, tenant, getRequiredAcceptances])

  useEffect(() => {
    checkAllRequired()
  }, [checkAllRequired])

  return {
    requiredDocs,
    hasAllRequired,
    isLoading,
    refreshRequired: checkAllRequired
  }
}

export default useLegalAcceptance