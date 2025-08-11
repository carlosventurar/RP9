'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { CollectionCard } from '@/components/collection-card'
import {
  Package,
  Search,
  Filter,
  SortAsc,
  Sparkles,
  Crown,
  Gift,
  TrendingUp,
  Star,
  Loader2,
  Grid3X3,
  List,
  Heart
} from 'lucide-react'

interface Collection {
  id: string
  name: string
  description: string
  creator_name: string
  is_featured: boolean
  bundle_price: number | null
  original_price: number
  discount_percentage: number
  savings: number
  image_url: string
  tags: string[]
  template_count: number
  templates: any[]
  total_installs: number
  average_rating: number
  review_count: number
  created_at: string
}

interface CollectionsResponse {
  success: boolean
  data: {
    collections: Collection[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
      hasNext: boolean
      hasPrev: boolean
    }
    filters: {
      featured: boolean
      category: string | null
      free: boolean
      sort: string
    }
  }
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters and sorting
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('featured')
  const [showFeatured, setShowFeatured] = useState(false)
  const [showFree, setShowFree] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCollections, setTotalCollections] = useState(0)

  const fetchCollections = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        sort: sortBy,
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(showFeatured && { featured: 'true' }),
        ...(showFree && { free: 'true' })
      })

      const response = await fetch(`/api/collections?${params}`)
      const data: CollectionsResponse = await response.json()

      if (data.success) {
        setCollections(data.data.collections)
        setTotalPages(data.data.pagination.pages)
        setTotalCollections(data.data.pagination.total)
      } else {
        throw new Error('Failed to fetch collections')
      }
    } catch (err) {
      console.error('Error fetching collections:', err)
      setError('Failed to load collections. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [currentPage, sortBy, selectedCategory, showFeatured, showFree])

  // Filter collections by search query (client-side)
  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'E-commerce', label: 'E-commerce' },
    { value: 'CRM & Sales', label: 'CRM & Sales' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'DevOps & IT', label: 'DevOps & IT' },
    { value: 'Communication', label: 'Communication' },
    { value: 'Productivity', label: 'Productivity' }
  ]

  const sortOptions = [
    { value: 'featured', label: 'Featured First' },
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' }
  ]

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Failed to load collections</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchCollections}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Template Collections</h1>
            <p className="text-muted-foreground">
              Curated bundles of templates designed to work together seamlessly
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4" />
            <span>Featured collections available</span>
          </div>
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            <span>Free collections included</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Up to 35% savings on bundles</span>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search collections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px]">
                  <SortAsc className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filter toggles */}
              <div className="flex gap-2">
                <Button
                  variant={showFeatured ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFeatured(!showFeatured)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Featured
                </Button>
                <Button
                  variant={showFree ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFree(!showFree)}
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Free
                </Button>
              </div>

              {/* View mode */}
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Active filters */}
          {(showFeatured || showFree || selectedCategory !== 'all' || searchQuery) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {showFeatured && (
                <Badge variant="secondary">
                  Featured
                  <button
                    onClick={() => setShowFeatured(false)}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {showFree && (
                <Badge variant="secondary">
                  Free
                  <button
                    onClick={() => setShowFree(false)}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {selectedCategory !== 'all' && (
                <Badge variant="secondary">
                  {categories.find(c => c.value === selectedCategory)?.label}
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary">
                  Search: {searchQuery}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : `${filteredCollections.length} collections found`}
            {totalCollections > 0 && ` (${totalCollections} total)`}
          </p>
        </div>
      </div>

      {/* Collections Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading collections...</p>
          </div>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No collections found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search terms or filters
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
                setShowFeatured(false)
                setShowFree(false)
              }}
            >
              Clear all filters
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Featured Collections Section (if any) */}
          {!showFree && !searchQuery && (
            <>
              {collections.filter(c => c.is_featured).length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-xl font-bold">Featured Collections</h2>
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                      Editor's Choice
                    </Badge>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {collections
                      .filter(c => c.is_featured)
                      .slice(0, 3)
                      .map((collection) => (
                        <CollectionCard
                          key={collection.id}
                          collection={collection}
                          variant="featured"
                          showTemplates
                        />
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* All Collections */}
          <div className={viewMode === 'grid' ? 
            'grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 
            'space-y-4'
          }>
            {filteredCollections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                variant={viewMode === 'list' ? 'compact' : 'default'}
                showTemplates={viewMode === 'grid'}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i
                  if (pageNum > totalPages) return null
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Call to Action */}
      <Card className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-8 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-blue-500" />
          <h3 className="text-xl font-bold mb-2">Create Your Own Collection</h3>
          <p className="text-muted-foreground mb-4">
            Bundle your favorite templates together and share them with the community
          </p>
          <Button>
            <Heart className="w-4 h-4 mr-2" />
            Create Collection
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}