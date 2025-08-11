'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Play,
  Code,
  Settings,
  Eye,
  Download,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Zap,
  Shield,
  ChevronRight,
  Loader2,
  Image as ImageIcon
} from 'lucide-react'
import { toast } from 'sonner'

interface TemplatePreview {
  id: string
  name: string
  description: string
  screenshots: {
    desktop: string
    tablet: string
    mobile: string
  }
  features: string[]
  configOptions: {
    id: string
    label: string
    type: 'text' | 'select' | 'boolean' | 'color' | 'number'
    default: any
    options?: any[]
    description?: string
  }[]
  demoUrl: string
  codePreview: {
    language: string
    code: string
    file: string
  }[]
  dependencies: string[]
  installSteps: string[]
  compatibility: string[]
  estimatedTime: number
}

interface TemplatePreviewModalProps {
  templateId: string
  isOpen: boolean
  onClose: () => void
  onInstall?: (config: Record<string, any>) => void
}

type ViewMode = 'desktop' | 'tablet' | 'mobile'

export function TemplatePreviewModal({
  templateId,
  isOpen,
  onClose,
  onInstall
}: TemplatePreviewModalProps) {
  const [preview, setPreview] = useState<TemplatePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('desktop')
  const [config, setConfig] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('preview')
  const [copySuccess, setCopySuccess] = useState<Record<string, boolean>>({})
  const [generatingScreenshots, setGeneratingScreenshots] = useState(false)

  // Load preview data
  useEffect(() => {
    if (isOpen && templateId) {
      loadPreview()
    }
  }, [isOpen, templateId])

  const loadPreview = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/templates/${templateId}/preview`)
      const data = await response.json()
      
      if (data.success) {
        setPreview(data.data)
        
        // Initialize config with default values
        const initialConfig: Record<string, any> = {}
        data.data.configOptions?.forEach((option: any) => {
          initialConfig[option.id] = option.default
        })
        setConfig(initialConfig)
      } else {
        toast.error('Failed to load template preview')
      }
    } catch (error) {
      console.error('Error loading preview:', error)
      toast.error('Error loading template preview')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigChange = (optionId: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [optionId]: value
    }))
  }

  const handleInstall = () => {
    if (onInstall) {
      onInstall(config)
    }
    toast.success('Template installation started!')
    onClose()
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(prev => ({ ...prev, [id]: true }))
      toast.success('Copied to clipboard!')
      
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [id]: false }))
      }, 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const generateNewScreenshots = async () => {
    if (!preview) return
    
    setGeneratingScreenshots(true)
    try {
      const response = await fetch(`/api/templates/${templateId}/preview`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setPreview(prev => prev ? {
          ...prev,
          screenshots: data.data.screenshots
        } : null)
        toast.success('Screenshots updated!')
      } else {
        toast.error('Failed to generate screenshots')
      }
    } catch (error) {
      console.error('Error generating screenshots:', error)
      toast.error('Error generating screenshots')
    } finally {
      setGeneratingScreenshots(false)
    }
  }

  const renderConfigOption = (option: TemplatePreview['configOptions'][0]) => {
    const value = config[option.id]
    
    switch (option.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleConfigChange(option.id, e.target.value)}
            placeholder={option.description}
          />
        )
      
      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(newValue) => handleConfigChange(option.id, newValue)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {option.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'boolean':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => handleConfigChange(option.id, checked)}
          />
        )
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleConfigChange(option.id, parseInt(e.target.value))}
            placeholder={option.description}
          />
        )
      
      case 'color':
        return (
          <div className="flex gap-2">
            <Input
              type="color"
              value={value || '#000000'}
              onChange={(e) => handleConfigChange(option.id, e.target.value)}
              className="w-16 h-10"
            />
            <Input
              value={value || ''}
              onChange={(e) => handleConfigChange(option.id, e.target.value)}
              placeholder="#000000"
            />
          </div>
        )
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[80vh]">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading template preview...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!preview) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <Eye className="w-5 h-5" />
            {preview.name}
            <Badge variant="secondary" className="ml-auto">
              <Clock className="w-3 h-3 mr-1" />
              ~{preview.estimatedTime} min
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {preview.description}
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 py-2 border-b">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="config">Configure</TabsTrigger>
              <TabsTrigger value="install">Install</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="preview" className="h-full m-0">
              <div className="h-full flex flex-col">
                {/* Preview Controls */}
                <div className="px-6 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex border rounded-lg">
                      <Button
                        variant={viewMode === 'desktop' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('desktop')}
                        className="rounded-r-none"
                      >
                        <Monitor className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'tablet' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('tablet')}
                        className="rounded-none"
                      >
                        <Tablet className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'mobile' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('mobile')}
                        className="rounded-l-none"
                      >
                        <Smartphone className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateNewScreenshots}
                      disabled={generatingScreenshots}
                    >
                      {generatingScreenshots ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Refresh Screenshots
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(preview.demoUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Live Demo
                    </Button>
                  </div>
                </div>

                {/* Screenshot Display */}
                <div className="flex-1 p-6 flex items-center justify-center bg-muted/20">
                  <div className={`border rounded-lg bg-white shadow-lg overflow-hidden ${
                    viewMode === 'desktop' ? 'w-full max-w-5xl aspect-video' :
                    viewMode === 'tablet' ? 'w-full max-w-2xl aspect-[3/4]' :
                    'w-full max-w-sm aspect-[9/16]'
                  }`}>
                    <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Preview
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {preview.screenshots[viewMode]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="code" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {preview.codePreview.map((code, index) => (
                    <div key={index} className="border rounded-lg">
                      <div className="px-4 py-2 bg-muted rounded-t-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          <span className="text-sm font-medium">{code.file}</span>
                          <Badge variant="outline" className="text-xs">
                            {code.language}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(code.code, `code-${index}`)}
                        >
                          {copySuccess[`code-${index}`] ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <div className="p-4">
                        <pre className="text-sm bg-muted/50 p-4 rounded overflow-x-auto">
                          <code>{code.code}</code>
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="config" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Configuration Options
                    </h3>
                    <div className="grid gap-6">
                      {preview.configOptions.map((option) => (
                        <div key={option.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={option.id} className="text-sm font-medium">
                              {option.label}
                            </Label>
                            {option.type === 'boolean' && renderConfigOption(option)}
                          </div>
                          {option.type !== 'boolean' && renderConfigOption(option)}
                          {option.description && (
                            <p className="text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Current Configuration</h4>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <pre className="text-sm overflow-x-auto">
                        <code>{JSON.stringify(config, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="install" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {/* Dependencies */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Requirements
                    </h3>
                    <div className="grid gap-2">
                      {preview.dependencies.map((dep, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          {dep}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Installation Steps */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Installation Steps
                    </h3>
                    <div className="space-y-3">
                      {preview.installSteps.map((step, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mt-0.5 shrink-0">
                            {index + 1}
                          </div>
                          <p className="text-sm">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Features */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">What's Included</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {preview.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t bg-background flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Compatible with: {preview.compatibility.join(', ')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={handleInstall} className="gap-2">
                <Download className="w-4 h-4" />
                Install Template
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}