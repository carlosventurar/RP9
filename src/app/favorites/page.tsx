'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { TemplateCard } from '@/components/template-card'
import { CollectionCard } from '@/components/collection-card'
import { FavoriteButton } from '@/components/favorite-button'
import {
  Heart,
  Search,
  Filter,
  SortAsc,
  Package,
  Star,
  Loader2,
  Grid3X3,
  List,
  BookmarkPlus,
  TrendingUp,
  Calendar,
  BarChart3,
  Trash2,
  Share2,
  Plus,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface FavoriteTemplate {
  favorite_id: string
  favorited_at: string
  id: string
  name: string
  description: string
  price: number
  category: string
  is_premium: boolean
  average_rating: number
  total_installs: number
  image_url: string
}

interface FavoriteCollection {
  favorite_id: string
  favorited_at: string
  id: string
  name: string
  description: string
  bundle_price: number | null
  discount_percentage: number
  template_count: number
  average_rating: number
  total_installs: number
  image_url: string
}

interface FavoritesData {
  templates: FavoriteTemplate[]
  collections: FavoriteCollection[]
}

interface FavoritesStats {
  total_template_favorites: number
  total_collection_favorites: number
  total_favorites: number
  favorite_categories: string[]
  most_favorited_category: string | null
}

interface TrendingItem {
  template_id?: string
  collection_id?: string
  template_name?: string
  collection_name?: string
  template_category?: string
  template_price?: number
  bundle_price?: number | null
  template_rating?: number
  collection_rating?: number
  favorite_count: number
  recent_favorites: number
  growth_percentage: number
  image_url: string
}

export default function FavoritesPage() {
  const { token, isAuthenticated, user } = useAuth()
  
  const [favorites, setFavorites] = useState<FavoritesData>({ templates: [], collections: [] })
  const [stats, setStats] = useState<FavoritesStats | null>(null)
  const [trending, setTrending] = useState<{ templates: TrendingItem[], collections: TrendingItem[] }>({ templates: [], collections: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters and sorting
  const [activeTab, setActiveTab] = useState<'all' | 'templates' | 'collections'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchFavorites()
      fetchTrending()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, token, activeTab, sortBy, selectedCategory])

  const fetchFavorites = async () => {
    try {
      setLoading(true)
      setError(null)

      const type = activeTab === 'all' ? 'both' : activeTab
      const params = new URLSearchParams({
        type,
        sort: sortBy,
        limit: '100', // Get all favorites for client-side filtering
        ...(selectedCategory !== 'all' && { category: selectedCategory })
      })

      const response = await fetch(`/api/favorites?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Handle the API response structure - favorites is an array, need to separate templates/collections
          const favoritesArray = data.data.favorites || []
          const separatedFavorites = {
            templates: favoritesArray.filter((item: any) => !item.bundle_price && !item.template_count), // Templates don't have bundle_price or template_count
            collections: favoritesArray.filter((item: any) => item.bundle_price !== undefined || item.template_count !== undefined) // Collections have these properties
          }
          setFavorites(separatedFavorites)
          setStats(data.data.stats)
        } else {
          throw new Error(data.error || 'Failed to fetch favorites')
        }
      } else if (response.status === 401) {
        throw new Error('Please sign in to view your favorites')
      } else {
        throw new Error('Failed to fetch favorites')
      }
    } catch (err) {
      console.error('Error fetching favorites:', err)
      setError(err instanceof Error ? err.message : 'Failed to load favorites')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrending = async () => {
    try {
      const response = await fetch('/api/favorites/trending?type=both&limit=5')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTrending(data.data.trending)
        }
      }
    } catch (err) {
      console.error('Error fetching trending favorites:', err)
    }
  }

  // Filter and search favorites client-side
  const filteredFavorites = {
    templates: favorites.templates.filter(template => 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.category.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    collections: favorites.collections.filter(collection =>
      collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  // Combine and paginate results
  const allItems = [
    ...filteredFavorites.templates.map(t => ({ ...t, type: 'template' as const })),
    ...filteredFavorites.collections.map(c => ({ ...c, type: 'collection' as const }))
  ]

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = allItems.slice(startIndex, endIndex)
  const totalPages = Math.ceil(allItems.length / itemsPerPage)

  const categories = stats?.favorite_categories || []

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Sign in to view favorites</h2>
            <p className="text-muted-foreground mb-4">
              Save your favorite templates and collections for easy access
            </p>
            <Button>
              Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Failed to load favorites</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchFavorites}>
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
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">My Favorites</h1>
            <p className="text-muted-foreground">
              Your saved templates and collections
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Favorites</p>
                    <p className="text-2xl font-bold">{stats.total_favorites}</p>
                  </div>
                  <Heart className="w-8 h-8 text-red-500 fill-current" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Templates</p>
                    <p className="text-2xl font-bold">{stats.total_template_favorites}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Collections</p>
                    <p className="text-2xl font-bold">{stats.total_collection_favorites}</p>
                  </div>
                  <Star className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Top Category</p>
                  <p className="text-lg font-semibold">
                    {stats.most_favorited_category || 'None'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your favorites...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Trending Section */}
          {(trending.templates.length > 0 || trending.collections.length > 0) && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Trending Favorites
                </CardTitle>
                <CardDescription>
                  Popular templates and collections based on recent favorites activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {trending.templates.slice(0, 3).map((item) => (
                    <div key={item.template_id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-1">{item.template_name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">+{item.recent_favorites} this week</Badge>
                          <span>{item.growth_percentage}% growth</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              {/* Tab Navigation */}
              <div className="flex items-center gap-2 mb-4">
                {(['all', 'templates', 'collections'] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setActiveTab(tab)
                      setCurrentPage(1)
                    }}
                    className="capitalize"
                  >
                    {tab === 'all' ? 'All' : tab}
                    {tab === 'templates' && stats && ` (${stats.total_template_favorites})`}
                    {tab === 'collections' && stats && ` (${stats.total_collection_favorites})`}
                  </Button>
                ))}
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search favorites..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]">
                    <SortAsc className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recently Added</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Mode */}
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
            </CardContent>
          </Card>

          {/* Results */}
          {allItems.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'No matching favorites found' : 'No favorites yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search terms or filters' 
                    : 'Start exploring templates and collections to build your favorites'
                  }
                </p>
                {!searchQuery && (
                  <div className="flex gap-2 justify-center">
                    <Button asChild>
                      <Link href="/templates">
                        Browse Templates
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/collections">
                        View Collections
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Results Grid/List */}
              <div className={viewMode === 'grid' ? 
                'grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 
                'space-y-4'
              }>
                {paginatedItems.map((item) => (
                  item.type === 'template' ? (
                    <div key={item.favorite_id} className="relative group">
                      <TemplateCard
                        template={item}
                        variant={viewMode === 'list' ? 'compact' : 'default'}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <FavoriteButton
                          itemId={item.id}
                          itemType="template"
                          itemName={item.name}
                          initialIsFavorited={true}
                          variant="ghost"
                          className="bg-white/90 hover:bg-white"
                          onFavoriteChange={(isFavorited) => {
                            if (!isFavorited) {
                              // Remove from local state
                              setFavorites(prev => ({
                                ...prev,
                                templates: prev.templates.filter(t => t.id !== item.id)
                              }))
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div key={item.favorite_id} className="relative group">
                      <CollectionCard
                        collection={item}
                        variant={viewMode === 'list' ? 'compact' : 'default'}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <FavoriteButton
                          itemId={item.id}
                          itemType="collection"
                          itemName={item.name}
                          initialIsFavorited={true}
                          variant="ghost"
                          className="bg-white/90 hover:bg-white"
                          onFavoriteChange={(isFavorited) => {
                            if (!isFavorited) {
                              // Remove from local state
                              setFavorites(prev => ({
                                ...prev,
                                collections: prev.collections.filter(c => c.id !== item.id)
                              }))
                            }
                          }}
                        />
                      </div>
                    </div>
                  )
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
        </>
      )}
    </div>
  )
}