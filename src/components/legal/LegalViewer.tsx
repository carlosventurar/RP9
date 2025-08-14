'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, FileText, Globe, Calendar, User, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface LegalDocument {
  id: string
  document_type: string
  version: string
  language: string
  title: string
  content: string
  effective_date: string
  requires_signature: boolean
  jurisdiction: string
}

interface LegalAcceptance {
  id: string
  accepted_at: string
  document_version: string
  ip_address: string
}

interface LegalViewerProps {
  documentType: 'tos' | 'privacy' | 'dpa' | 'msa'
  locale: string
  userId?: string
  tenantId?: string
  showAcceptanceButton?: boolean
  className?: string
}

export function LegalViewer({ 
  documentType, 
  locale, 
  userId, 
  tenantId,
  showAcceptanceButton = false,
  className = "" 
}: LegalViewerProps) {
  const t = useTranslations('legal')
  const { toast } = useToast()
  const supabase = createClient()
  
  const [document, setDocument] = useState<LegalDocument | null>(null)
  const [acceptance, setAcceptance] = useState<LegalAcceptance | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map locale to language code
  const language = locale.startsWith('en') ? 'en' : 'es'

  useEffect(() => {
    loadDocument()
    if (userId && tenantId) {
      checkAcceptance()
    }
  }, [documentType, language, userId, tenantId])

  const loadDocument = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('document_type', documentType)
        .eq('language', language)
        .eq('status', 'active')
        .order('effective_date', { ascending: false })
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        setDocument(data[0])
      } else {
        setError(t('document_not_found'))
      }
    } catch (err) {
      console.error('Error loading legal document:', err)
      setError(t('error_loading_document'))
    } finally {
      setLoading(false)
    }
  }

  const checkAcceptance = async () => {
    if (!userId || !tenantId || !document) return

    try {
      const { data, error } = await supabase
        .from('legal_acceptances')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('document_type', documentType)
        .eq('document_version', document.version)
        .eq('language', language)
        .order('accepted_at', { ascending: false })
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        setAcceptance(data[0])
      }
    } catch (err) {
      console.error('Error checking acceptance:', err)
    }
  }

  const handleAccept = async () => {
    if (!userId || !tenantId || !document) return

    setAccepting(true)
    try {
      const response = await fetch('/.netlify/functions/legal-accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_type: documentType,
          version: document.version,
          tenant_id: tenantId,
          user_id: userId,
          language: language
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to accept document')
      }

      // Update local state
      setAcceptance({
        id: result.data.acceptance_id,
        accepted_at: result.data.accepted_at,
        document_version: result.data.version,
        ip_address: result.data.ip_address
      })

      toast({
        title: t('acceptance_recorded'),
        description: t('acceptance_success_message'),
        duration: 5000
      })

    } catch (err) {
      console.error('Error accepting document:', err)
      toast({
        title: t('acceptance_error'),
        description: err instanceof Error ? err.message : t('acceptance_error_message'),
        variant: 'destructive'
      })
    } finally {
      setAccepting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    return content
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-3xl font-bold mt-8 mb-4">{line.slice(2)}</h1>
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-2xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-xl font-semibold mt-4 mb-2">{line.slice(4)}</h3>
        }
        
        // Lists
        if (line.startsWith('- ')) {
          return <li key={index} className="ml-4 mb-1">{line.slice(2)}</li>
        }
        
        // Paragraphs
        if (line.trim()) {
          return <p key={index} className="mb-3 leading-relaxed">{line}</p>
        }
        
        // Empty lines
        return <br key={index} />
      })
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('loading_document')}</p>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600 font-medium">{error || t('document_not_available')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Document Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6" />
                {document.title}
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {language.toUpperCase()}
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('version')} {document.version}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {document.jurisdiction}
                </span>
              </div>
            </div>
            {acceptance && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {t('accepted')}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        {acceptance && (
          <CardContent className="pt-0">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-800 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">
                  {t('accepted_on')} {formatDate(acceptance.accepted_at)}
                </span>
              </div>
              <p className="text-green-700 text-xs mt-1">
                {t('version_accepted')}: {acceptance.document_version}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Document Content */}
      <Card>
        <CardContent className="p-6">
          <ScrollArea className="h-[600px] pr-4">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <div className="text-sm text-muted-foreground mb-6">
                <strong>{t('effective_date')}:</strong> {formatDate(document.effective_date)}
              </div>
              <Separator className="mb-6" />
              {renderContent(document.content)}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Acceptance Section */}
      {showAcceptanceButton && userId && tenantId && !acceptance && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <User className="h-5 w-5 text-blue-600 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">{t('acceptance_required')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('acceptance_description')}
                </p>
                <Button 
                  onClick={handleAccept} 
                  disabled={accepting}
                  className="w-full sm:w-auto"
                >
                  {accepting ? t('processing') : t('accept_document')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default LegalViewer