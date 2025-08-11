'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  FileText, 
  Shield, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Loader2,
  RefreshCw,
  Globe
} from "lucide-react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'

interface FinanceKPIs {
  period: string
  totalDocuments: number
  validDocuments: number
  invalidDocuments: number
  validationRate: number
  avgValidationScore: number
  totalFileSize: number
  avgFileSize: number
  documentsByType: Array<{
    type: string
    count: number
    validationRate: number
  }>
  documentsByCountry: Array<{
    country: string
    count: number
    validationRate: number
  }>
  validationErrors: Array<{
    error: string
    count: number
  }>
  timeSavings: {
    totalDocuments: number
    avgProcessingTimeMinutes: number
    totalTimeSavedHours: number
  }
  complianceMetrics: {
    cfdiDocuments: number
    cfdiValidRate: number
    dianDocuments: number
    dianValidRate: number
  }
  storageMetrics: {
    totalStorageUsedMB: number
    avgDocumentSizeMB: number
    documentsWithHash: number
    hashVerificationRate: number
  }
}

const COLORS = {
  valid: '#10b981',
  invalid: '#ef4444',
  warning: '#f59e0b',
  primary: '#3b82f6',
  secondary: '#8b5cf6'
}

export default function FinKPIs() {
  const [kpis, setKPIs] = useState<FinanceKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')
  const [refreshing, setRefreshing] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadKPIs()
  }, [period])

  async function loadKPIs() {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('No authentication session')
        return
      }

      const response = await fetch(`/.netlify/functions/kpi-fin?period=${period}&details=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      setKPIs(result.data)
      
    } catch (error) {
      console.error('Error loading Finance KPIs:', error)
      setError(error instanceof Error ? error.message : 'Failed to load KPIs')
      
      // Set mock data for development
      setKPIs({
        period: '7d',
        totalDocuments: 156,
        validDocuments: 142,
        invalidDocuments: 14,
        validationRate: 91.0,
        avgValidationScore: 87.5,
        totalFileSize: 2456789,
        avgFileSize: 15748,
        documentsByType: [
          { type: 'CFDI', count: 89, validationRate: 94.4 },
          { type: 'DIAN', count: 43, validationRate: 88.4 },
          { type: 'INVOICE', count: 24, validationRate: 83.3 }
        ],
        documentsByCountry: [
          { country: 'MX', count: 95, validationRate: 93.7 },
          { country: 'CO', count: 48, validationRate: 87.5 },
          { country: 'US', count: 13, validationRate: 92.3 }
        ],
        validationErrors: [
          { error: 'Invalid XML structure', count: 8 },
          { error: 'Missing required fields', count: 5 },
          { error: 'Invalid date format', count: 3 }
        ],
        timeSavings: {
          totalDocuments: 156,
          avgProcessingTimeMinutes: 10,
          totalTimeSavedHours: 24.7
        },
        complianceMetrics: {
          cfdiDocuments: 89,
          cfdiValidRate: 94.4,
          dianDocuments: 43,
          dianValidRate: 88.4
        },
        storageMetrics: {
          totalStorageUsedMB: 2.34,
          avgDocumentSizeMB: 0.015,
          documentsWithHash: 156,
          hashVerificationRate: 100.0
        }
      })
      
    } finally {
      setLoading(false)
    }
  }

  async function refreshData() {
    setRefreshing(true)
    await loadKPIs()
    setRefreshing(false)
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

  function formatHours(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`
    }
    return `${hours.toFixed(1)}h`
  }

  if (loading && !kpis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Finance KPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!kpis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Finance KPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {error || 'No finance data available'}
            </p>
            <Button onClick={refreshData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const typeChartData = kpis.documentsByType.map(item => ({
    name: item.type,
    count: item.count,
    validationRate: item.validationRate
  }))

  const countryChartData = kpis.documentsByCountry.map(item => ({
    name: item.country,
    count: item.count,
    validationRate: item.validationRate
  }))

  const validationPieData = [
    { name: 'Valid', value: kpis.validDocuments, color: COLORS.valid },
    { name: 'Invalid', value: kpis.invalidDocuments, color: COLORS.invalid }
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Finance KPIs
          </h2>
          <p className="text-muted-foreground">
            Document validation and compliance metrics
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{kpis.totalDocuments.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Validation Rate</p>
                <p className="text-2xl font-bold">{kpis.validationRate}%</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{kpis.avgValidationScore}/100</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time Saved</p>
                <p className="text-2xl font-bold">{formatHours(kpis.timeSavings.totalTimeSavedHours)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Overview and Document Types */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Validation Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={validationPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {validationPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4">
              {validationPieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Metrics
          </CardTitle>
          <CardDescription>Regional compliance document validation rates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div>
                <span className="text-sm font-medium">CFDI (Mexico)</span>
                <p className="text-xs text-muted-foreground">{kpis.complianceMetrics.cfdiDocuments} documents</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{kpis.complianceMetrics.cfdiValidRate}%</span>
                {kpis.complianceMetrics.cfdiValidRate >= 90 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div>
                <span className="text-sm font-medium">DIAN (Colombia)</span>
                <p className="text-xs text-muted-foreground">{kpis.complianceMetrics.dianDocuments} documents</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{kpis.complianceMetrics.dianValidRate}%</span>
                {kpis.complianceMetrics.dianValidRate >= 90 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents by Country and Storage Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Documents by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpis.documentsByCountry.map((country, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                      <span className="text-xs font-bold text-primary">
                        {country.country}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{country.country}</p>
                      <p className="text-sm text-muted-foreground">
                        {country.count} documents
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {country.validationRate}%
                    </p>
                    <Badge variant={country.validationRate >= 90 ? "default" : "secondary"}>
                      {country.validationRate >= 90 ? "Good" : "Needs attention"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">Total Storage</span>
              <span className="font-bold">{kpis.storageMetrics.totalStorageUsedMB.toFixed(1)} MB</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">Avg Document Size</span>
              <span className="font-bold">{formatFileSize(kpis.avgFileSize)}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">Hash Verification</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{kpis.storageMetrics.hashVerificationRate}%</span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium">Time Efficiency</span>
              <span className="font-bold">{formatHours(kpis.timeSavings.totalTimeSavedHours)} saved</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Common Errors */}
      {kpis.validationErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Common Validation Issues
            </CardTitle>
            <CardDescription>Most frequent validation errors to address</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpis.validationErrors.slice(0, 5).map((error, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-destructive/10 rounded-full">
                      <span className="text-sm font-bold text-destructive">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-sm font-medium">{error.error}</span>
                  </div>
                  
                  <Badge variant="destructive">
                    {error.count} occurrences
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}