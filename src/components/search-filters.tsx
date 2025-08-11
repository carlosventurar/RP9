'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Filter,
  X,
  Star,
  DollarSign,
  Clock,
  Zap,
  Shield,
  Layers,
  Tag,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react'

export interface SearchFilters {
  category?: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  priceType?: 'all' | 'free' | 'premium'
  difficulty?: string
  compatibility?: string
  tags?: string[]
  maxInstallTime?: number
  supportLevel?: string
  type?: 'all' | 'templates' | 'collections'
}

interface SearchFiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  resultCounts?: {
    total: number
    templates: number
    collections: number
  }
  facets?: {
    categories: string[]
    priceRange: { min: number; max: number }
  }
  className?: string
}

// Predefined filter options
const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'CRM & Sales', label: 'CRM & Sales' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Communication', label: 'Communication' },
  { value: 'Analytics', label: 'Analytics' },
  { value: 'DevOps & IT', label: 'DevOps & IT' },
  { value: 'Productivity', label: 'Productivity' },
  { value: 'Finance', label: 'Finance' }
]

const difficulties = [
  { value: 'all', label: 'Any Difficulty' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
]

const supportLevels = [
  { value: 'all', label: 'Any Support' },
  { value: 'community', label: 'Community' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' }
]

const compatibilityOptions = [
  'Shopify', 'WooCommerce', 'Magento', 'Salesforce', 'HubSpot', 'Pipedrive',
  'Facebook Ads', 'Google Ads', 'LinkedIn', 'Twitter', 'SMTP', 'SendGrid',
  'Mailgun', 'AWS SES', 'Google Analytics', 'Custom APIs', 'Database'
]

const popularTags = [
  'inventory', 'sync', 'real-time', 'automation', 'ai', 'machine-learning',
  'dashboard', 'analytics', 'email', 'notifications', 'campaigns', 'crm',
  'sales', 'marketing', 'e-commerce', 'pro', 'advanced', 'free'
]

export function SearchFilters({
  filters,
  onFiltersChange,
  resultCounts,
  facets,
  className = ''
}: SearchFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    category: true,
    price: true,
    rating: true,
    difficulty: false,
    compatibility: false,
    tags: false,
    advanced: false
  })

  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.minPrice || 0,
    filters.maxPrice || 200
  ])

  const [installTimeRange, setInstallTimeRange] = useState<[number]>([
    filters.maxInstallTime || 60
  ])

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const toggleTag = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    
    updateFilter('tags', newTags.length > 0 ? newTags : undefined)
  }

  const clearAllFilters = () => {
    onFiltersChange({})
    setPriceRange([0, 200])
    setInstallTimeRange([60])
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== 'all' && 
    (Array.isArray(value) ? value.length > 0 : true)
  )

  const activeFilterCount = Object.values(filters).filter(value =>
    value !== undefined && value !== 'all' && 
    (Array.isArray(value) ? value.length > 0 : true)
  ).length

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <CardTitle className="text-base">Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
        
        {resultCounts && (
          <CardDescription className="text-xs">
            {resultCounts.total} results found
            {resultCounts.templates > 0 && ` (${resultCounts.templates} templates`}
            {resultCounts.collections > 0 && `, ${resultCounts.collections} collections)`}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Type Filter */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4" />
            Content Type
          </Label>
          <Select value={filters.type || 'all'} onValueChange={(value) => updateFilter('type', value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="templates">Templates Only</SelectItem>
              <SelectItem value="collections">Collections Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Category Filter */}
        <div>
          <button
            onClick={() => toggleSection('category')}
            className="w-full flex items-center justify-between text-sm font-medium mb-2 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Category
            </div>
            {expandedSections.category ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.category && (
            <Select value={filters.category || 'all'} onValueChange={(value) => updateFilter('category', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        {/* Price Filter */}
        <div>
          <button
            onClick={() => toggleSection('price')}
            className="w-full flex items-center justify-between text-sm font-medium mb-2 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Price
            </div>
            {expandedSections.price ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.price && (
            <div className="space-y-3">
              {/* Price Type */}
              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={filters.priceType || 'all'} onValueChange={(value) => updateFilter('priceType', value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Prices</SelectItem>
                    <SelectItem value="free">Free Only</SelectItem>
                    <SelectItem value="premium">Premium Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Price Range */}
              {filters.priceType !== 'free' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Range: ${priceRange[0]} - ${priceRange[1]}</Label>
                  <Slider
                    value={priceRange}
                    onValueChange={(value) => {
                      setPriceRange(value as [number, number])
                      updateFilter('minPrice', value[0])
                      updateFilter('maxPrice', value[1])
                    }}
                    min={0}
                    max={200}
                    step={5}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>$0</span>
                    <span>$200+</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Rating Filter */}
        <div>
          <button
            onClick={() => toggleSection('rating')}
            className="w-full flex items-center justify-between text-sm font-medium mb-2 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Minimum Rating
            </div>
            {expandedSections.rating ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.rating && (
            <div className="flex flex-wrap gap-2">
              {[4.5, 4.0, 3.5, 3.0].map(rating => (
                <Button
                  key={rating}
                  variant={filters.minRating === rating ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateFilter('minRating', filters.minRating === rating ? undefined : rating)}
                  className="text-xs"
                >
                  <Star className="w-3 h-3 mr-1 fill-current text-yellow-400" />
                  {rating}+
                </Button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Difficulty Filter */}
        <div>
          <button
            onClick={() => toggleSection('difficulty')}
            className="w-full flex items-center justify-between text-sm font-medium mb-2 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Difficulty
            </div>
            {expandedSections.difficulty ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.difficulty && (
            <Select value={filters.difficulty || 'all'} onValueChange={(value) => updateFilter('difficulty', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map(diff => (
                  <SelectItem key={diff.value} value={diff.value}>
                    {diff.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Compatibility Filter */}
        <div>
          <button
            onClick={() => toggleSection('compatibility')}
            className="w-full flex items-center justify-between text-sm font-medium mb-2 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Compatibility
            </div>
            {expandedSections.compatibility ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.compatibility && (
            <Select value={filters.compatibility || ''} onValueChange={(value) => updateFilter('compatibility', value || undefined)}>
              <SelectTrigger>
                <SelectValue placeholder="Any platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any Platform</SelectItem>
                {compatibilityOptions.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tags Filter */}
        <div>
          <button
            onClick={() => toggleSection('tags')}
            className="w-full flex items-center justify-between text-sm font-medium mb-2 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
              {filters.tags && filters.tags.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {filters.tags.length}
                </Badge>
              )}
            </div>
            {expandedSections.tags ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.tags && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {popularTags.map(tag => (
                  <Button
                    key={tag}
                    variant={filters.tags?.includes(tag) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleTag(tag)}
                    className="text-xs h-6"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
              
              {filters.tags && filters.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Selected:</span>
                  {filters.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTag(tag)}
                        className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Advanced Filters */}
        <div>
          <button
            onClick={() => toggleSection('advanced')}
            className="w-full flex items-center justify-between text-sm font-medium mb-2 hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Advanced
            </div>
            {expandedSections.advanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.advanced && (
            <div className="space-y-4">
              {/* Installation Time */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Max Installation Time: {installTimeRange[0]} minutes
                </Label>
                <Slider
                  value={installTimeRange}
                  onValueChange={(value) => {
                    setInstallTimeRange(value as [number])
                    updateFilter('maxInstallTime', value[0])
                  }}
                  min={5}
                  max={120}
                  step={5}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>5 min</span>
                  <span>2+ hours</span>
                </div>
              </div>
              
              {/* Support Level */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Support Level</Label>
                <Select value={filters.supportLevel || 'all'} onValueChange={(value) => updateFilter('supportLevel', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportLevels.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}