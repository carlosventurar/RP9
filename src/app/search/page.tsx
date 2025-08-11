'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { SearchAutocomplete } from '@/components/search-autocomplete'
import { SearchFilters, SearchFilters as SearchFiltersType } from '@/components/search-filters'
import { TemplateCard } from '@/components/template-card'
import {
  Search,
  Filter,
  SlidersHorizontal,
  Grid3X3,
  List,
  TrendingUp,
  Clock,
  Star,
  Download,
  AlertCircle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'

interface SearchResult {
  id: string
  name: string
  description: string
  category: string
  price: number
  rating: number
  reviewCount: number
  downloadCount: number
  tags: string[]
  thumbnail: string
  compatibility: string[]
  difficulty: string
  installTime: number
  supportLevel: string
  type: 'template' | 'collection'
  author: string
  lastUpdated: string
  featured: boolean
}

type SortOption = 'relevance' | 'rating' | 'downloads' | 'newest' | 'price-low' | 'price-high' | 'name'
type ViewMode = 'grid' | 'list'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams?.get('q') || ''
  
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [filters, setFilters] = useState<SearchFiltersType>({})
  const [results, setResults] = useState<SearchResult[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('relevance')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasSearched, setHasSearched] = useState(!!initialQuery)
  
  const resultsPerPage = 12
  const totalPages = Math.ceil(totalResults / resultsPerPage)

  // Perform search
  const performSearch = async (query: string = searchQuery, page: number = 1) => {
    if (!query.trim() && Object.keys(filters).length === 0) return
    
    setLoading(true)
    setHasSearched(true)
    
    try {
      const searchFilters = {
        ...filters,
        page: page - 1,
        limit: resultsPerPage,
        sort: sortBy
      }
      
      const queryString = new URLSearchParams({
        q: query,
        ...Object.fromEntries(
          Object.entries(searchFilters).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(',') : String(value)
          ])
        )
      }).toString()
      
      const response = await fetch(`/api/search?${queryString}`)
      const data = await response.json()
      
      if (data.success) {
        setResults(data.data.results || [])
        setTotalResults(data.data.total || 0)
        setCurrentPage(page)
      } else {
        toast.error('Error searching templates')
        setResults([])
        setTotalResults(0)
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Search failed. Please try again.')
      setResults([])
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  // Search when query, filters, or sort changes
  useEffect(() => {
    if (searchQuery || Object.keys(filters).length > 0) {
      performSearch(searchQuery, 1)
    }
  }, [searchQuery, filters, sortBy])

  // Search on initial load if query exists
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, 1)
    }
  }, [])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handleFiltersChange = (newFilters: SearchFiltersType) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    performSearch(searchQuery, page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const clearSearch = () => {
    setSearchQuery('')
    setFilters({})
    setResults([])
    setTotalResults(0)
    setHasSearched(false)
    setCurrentPage(1)
  }

  // Calculate result counts for filters
  const resultCounts = useMemo(() => {
    const templates = results.filter(r => r.type === 'template').length
    const collections = results.filter(r => r.type === 'collection').length
    return {
      total: totalResults,
      templates,
      collections
    }
  }, [results, totalResults])

  // Get active filter count
  const activeFilterCount = Object.values(filters).filter(value =>
    value !== undefined && value !== 'all' && 
    (Array.isArray(value) ? value.length > 0 : true)
  ).length

  const sortOptions = [
    { value: 'relevance', label: 'Most Relevant', icon: TrendingUp },
    { value: 'rating', label: 'Highest Rated', icon: Star },
    { value: 'downloads', label: 'Most Downloads', icon: Download },
    { value: 'newest', label: 'Newest First', icon: Clock },
    { value: 'price-low', label: 'Price: Low to High', icon: TrendingUp },
    { value: 'price-high', label: 'Price: High to Low', icon: TrendingUp },
    { value: 'name', label: 'Name A-Z', icon: TrendingUp }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-2xl">
                <SearchAutocomplete
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  onSearch={handleSearch}
                  placeholder="Search templates, collections, and more..."
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* Search Stats & Controls */}
            {hasSearched && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-sm text-muted-foreground">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </div>
                    ) : (
                      <span>
                        {totalResults.toLocaleString()} results
                        {searchQuery && ` for "${searchQuery}"`}
                      </span>
                    )}
                  </div>
                  
                  {(searchQuery || activeFilterCount > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSearch}
                      className="text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear all
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Sort Selector */}
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Separator orientation="vertical" className="h-6" />

                  {/* View Mode Toggle */}
                  <div className="flex items-center border rounded-lg">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="rounded-r-none"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="rounded-l-none"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block w-80 shrink-0`}>
            <div className="sticky top-32">
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                resultCounts={resultCounts}
              />
            </div>
          </div>

          {/* Results Content */}
          <div className="flex-1 min-w-0">
            {!hasSearched ? (
              /* Welcome State */
              <div className="text-center py-16">
                <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-semibold mb-2">Search Templates & Collections</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Discover powerful templates and collections to accelerate your projects. 
                  Use filters to find exactly what you need.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  {['E-commerce', 'CRM & Sales', 'Marketing', 'Analytics'].map(category => (
                    <Button
                      key={category}
                      variant="outline"
                      onClick={() => {
                        setFilters({ category })
                        setHasSearched(true)
                      }}
                      className="text-sm"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            ) : loading ? (
              /* Loading State */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="aspect-video bg-muted rounded-t-lg" />
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-2/3 mb-4" />
                      <div className="flex justify-between">
                        <div className="h-3 bg-muted rounded w-1/4" />
                        <div className="h-3 bg-muted rounded w-1/4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : results.length === 0 ? (
              /* No Results State */
              <div className="text-center py-16">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={clearSearch}>
                    Clear search
                  </Button>
                  <Button onClick={() => setShowFilters(!showFilters)}>
                    Adjust filters
                  </Button>
                </div>
              </div>
            ) : (
              /* Results */
              <>
                <div className={`grid gap-6 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                    : 'grid-cols-1'
                }`}>
                  {results.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      variant={viewMode === 'list' ? 'compact' : 'default'}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * resultsPerPage) + 1} to {Math.min(currentPage * resultsPerPage, totalResults)} of {totalResults} results
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-10"
                            >
                              {pageNum}
                            </Button>
                          )
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}