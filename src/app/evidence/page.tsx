'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  FileText, 
  Download, 
  Search, 
  Filter,
  Calendar,
  Globe,
  Shield,
  FileCheck,
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'

interface EvidenceFile {
  id: string
  file_name: string
  file_type: string
  document_type: string
  country: string
  validation_status: string
  validation_score: number | null
  size_bytes: number
  sha256: string
  created_at: string
  workflow_id: string | null
  created_by: string | null
}

export default function EvidencePage() {
  const [files, setFiles] = useState<EvidenceFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  const supabase = createClient()

  useEffect(() => {
    loadFiles()
  }, [])

  async function loadFiles() {
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

      // Fetch evidence files
      const { data: evidenceFiles, error: filesError } = await supabase
        .from('evidence_files')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (filesError) {
        throw new Error(filesError.message)
      }

      setFiles(evidenceFiles || [])
      
    } catch (error) {
      console.error('Error loading evidence files:', error)
      setError(error instanceof Error ? error.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  async function downloadFile(file: EvidenceFile) {
    setDownloadingId(file.id)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No authentication session')
      }

      const response = await fetch(`/.netlify/functions/evidence-get?fileId=${file.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      // Trigger download
      const link = document.createElement('a')
      link.href = result.downloadUrl
      link.download = file.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Download error:', error)
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDownloadingId(null)
    }
  }

  function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getValidationBadge(status: string, score: number | null) {
    switch (status) {
      case 'valid':
        return <Badge variant="default" className="bg-green-500"><FileCheck className="h-3 w-3 mr-1" />Valid</Badge>
      case 'invalid':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Invalid</Badge>
      case 'pending':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  function getDocumentTypeBadge(type: string) {
    const colors: Record<string, string> = {
      'CFDI': 'bg-blue-500',
      'DIAN': 'bg-green-500',
      'INVOICE': 'bg-purple-500',
      'RECEIPT': 'bg-orange-500',
      'CONTRACT': 'bg-red-500'
    }
    
    return (
      <Badge 
        variant="outline" 
        className={`${colors[type] || 'bg-gray-500'} text-white border-transparent`}
      >
        {type}
      </Badge>
    )
  }

  function getCountryFlag(country: string) {
    const flags: Record<string, string> = {
      'MX': '🇲🇽',
      'CO': '🇨🇴',
      'US': '🇺🇸',
      'CA': '🇨🇦',
      'BR': '🇧🇷',
      'AR': '🇦🇷'
    }
    
    return flags[country] || '🌐'
  }

  // Apply filters
  const filteredFiles = files.filter(file => {
    const matchesSearch = searchTerm === '' || 
      file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.document_type.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = documentTypeFilter === 'all' || file.document_type === documentTypeFilter
    const matchesCountry = countryFilter === 'all' || file.country === countryFilter
    const matchesStatus = statusFilter === 'all' || file.validation_status === statusFilter
    
    let matchesDate = true
    if (dateFilter !== 'all') {
      const fileDate = new Date(file.created_at)
      const now = new Date()
      const daysDiff = (now.getTime() - fileDate.getTime()) / (1000 * 3600 * 24)
      
      switch (dateFilter) {
        case '24h': matchesDate = daysDiff <= 1; break
        case '7d': matchesDate = daysDiff <= 7; break
        case '30d': matchesDate = daysDiff <= 30; break
        case '90d': matchesDate = daysDiff <= 90; break
      }
    }
    
    return matchesSearch && matchesType && matchesCountry && matchesStatus && matchesDate
  })

  // Get unique values for filters
  const documentTypes = Array.from(new Set(files.map(f => f.document_type))).filter(Boolean)
  const countries = Array.from(new Set(files.map(f => f.country))).filter(Boolean)

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Evidence Management
        </h1>
        <p className="text-muted-foreground">
          Manage and download your validated financial documents
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {documentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map(country => (
                  <SelectItem key={country} value={country}>
                    {getCountryFlag(country)} {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredFiles.length} of {files.length} files
            </p>
            <Button variant="outline" size="sm" onClick={loadFiles}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Your uploaded and validated financial documents</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={loadFiles} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-2">No documents found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm || documentTypeFilter !== 'all' || countryFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Upload some documents to get started'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">File Name</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Country</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Size</th>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map(file => (
                    <tr key={file.id} className="border-b hover:bg-secondary/50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.file_type.toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {getDocumentTypeBadge(file.document_type)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCountryFlag(file.country)}</span>
                          <span className="text-sm">{file.country}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {getValidationBadge(file.validation_status, file.validation_score)}
                          {file.validation_score !== null && (
                            <span className="text-xs text-muted-foreground">
                              Score: {file.validation_score}/100
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{formatFileSize(file.size_bytes)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{formatDate(file.created_at)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile(file)}
                          disabled={downloadingId === file.id}
                        >
                          {downloadingId === file.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}