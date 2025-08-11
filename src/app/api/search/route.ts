/**
 * Advanced Search API
 * Handles advanced template and collection search with filters, ranking, and relevance
 * Sprint 3.5: Template Search Avanzado
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock templates for search (in real app, this would come from database)
const mockTemplates = [
  {
    id: 'template-1',
    name: 'Multi-Channel Inventory Sync Pro',
    description: 'Synchronize inventory across multiple sales channels in real-time. Perfect for e-commerce businesses managing inventory on multiple platforms.',
    price: 35.00,
    category: 'E-commerce',
    tags: ['inventory', 'sync', 'multi-channel', 'real-time', 'e-commerce', 'pro'],
    is_premium: true,
    average_rating: 4.8,
    total_installs: 2456,
    creator: 'RP9 Team',
    created_at: '2024-09-15T10:00:00Z',
    updated_at: '2024-11-01T14:30:00Z',
    image_url: '/images/templates/inventory-sync.jpg',
    difficulty: 'intermediate',
    compatibility: ['Shopify', 'WooCommerce', 'Magento'],
    features: ['Real-time sync', 'Multi-platform', 'Automated alerts', 'Analytics dashboard'],
    use_cases: ['E-commerce stores', 'Multi-channel retailers', 'Inventory management'],
    installation_time: 15, // minutes
    support_level: 'premium'
  },
  {
    id: 'template-2',
    name: 'Advanced Product Catalog Manager',
    description: 'Comprehensive product catalog management with advanced filtering and categorization features.',
    price: 29.99,
    category: 'E-commerce',
    tags: ['catalog', 'products', 'management', 'filtering', 'categories', 'advanced'],
    is_premium: true,
    average_rating: 4.6,
    total_installs: 1834,
    creator: 'CatalogPro',
    created_at: '2024-09-20T14:30:00Z',
    updated_at: '2024-10-25T09:15:00Z',
    image_url: '/images/templates/catalog-manager.jpg',
    difficulty: 'beginner',
    compatibility: ['Shopify', 'WooCommerce'],
    features: ['Advanced filtering', 'Bulk operations', 'Category management', 'SEO optimization'],
    use_cases: ['Online stores', 'Product catalogs', 'Inventory organization'],
    installation_time: 10,
    support_level: 'standard'
  },
  {
    id: 'template-3',
    name: 'Advanced Lead Scoring AI Pro',
    description: 'AI-powered lead scoring system with machine learning algorithms to identify high-quality prospects.',
    price: 50.00,
    category: 'CRM & Sales',
    tags: ['lead-scoring', 'ai', 'machine-learning', 'crm', 'sales', 'automation', 'pro'],
    is_premium: true,
    average_rating: 4.9,
    total_installs: 1523,
    creator: 'AI Solutions',
    created_at: '2024-09-25T09:15:00Z',
    updated_at: '2024-11-02T11:20:00Z',
    image_url: '/images/templates/lead-scoring.jpg',
    difficulty: 'advanced',
    compatibility: ['Salesforce', 'HubSpot', 'Pipedrive'],
    features: ['AI-powered scoring', 'Predictive analytics', 'Custom models', 'Integration ready'],
    use_cases: ['Sales teams', 'Marketing automation', 'Lead qualification'],
    installation_time: 30,
    support_level: 'premium'
  },
  {
    id: 'template-4',
    name: 'Cross-Platform Campaign Manager',
    description: 'Manage marketing campaigns across multiple platforms from a single dashboard.',
    price: 35.00,
    category: 'Marketing',
    tags: ['campaigns', 'marketing', 'cross-platform', 'management', 'automation', 'social-media'],
    is_premium: true,
    average_rating: 4.7,
    total_installs: 987,
    creator: 'MarketingHub',
    created_at: '2024-10-01T16:45:00Z',
    updated_at: '2024-10-30T08:30:00Z',
    image_url: '/images/templates/campaign-manager.jpg',
    difficulty: 'intermediate',
    compatibility: ['Facebook Ads', 'Google Ads', 'LinkedIn', 'Twitter'],
    features: ['Multi-platform', 'Campaign automation', 'Performance tracking', 'A/B testing'],
    use_cases: ['Marketing agencies', 'Social media management', 'Campaign optimization'],
    installation_time: 20,
    support_level: 'standard'
  },
  {
    id: 'template-5',
    name: 'Email Notification System',
    description: 'Reliable email notification system with template support and delivery tracking.',
    price: 0,
    category: 'Communication',
    tags: ['email', 'notifications', 'templates', 'delivery', 'free', 'communication'],
    is_premium: false,
    average_rating: 4.4,
    total_installs: 5234,
    creator: 'OpenSource Community',
    created_at: '2024-08-10T16:45:00Z',
    updated_at: '2024-10-15T12:00:00Z',
    image_url: '/images/templates/email-system.jpg',
    difficulty: 'beginner',
    compatibility: ['SMTP', 'SendGrid', 'Mailgun', 'AWS SES'],
    features: ['Template system', 'Delivery tracking', 'Queue management', 'Error handling'],
    use_cases: ['User notifications', 'Transactional emails', 'Marketing emails'],
    installation_time: 5,
    support_level: 'community'
  },
  {
    id: 'template-6',
    name: 'Real-Time Analytics Dashboard',
    description: 'Comprehensive analytics dashboard with real-time data visualization and reporting.',
    price: 45.00,
    category: 'Analytics',
    tags: ['analytics', 'dashboard', 'real-time', 'visualization', 'reporting', 'charts'],
    is_premium: true,
    average_rating: 4.8,
    total_installs: 1156,
    creator: 'DataViz Pro',
    created_at: '2024-09-30T11:20:00Z',
    updated_at: '2024-11-01T15:45:00Z',
    image_url: '/images/templates/analytics-dashboard.jpg',
    difficulty: 'intermediate',
    compatibility: ['Google Analytics', 'Custom APIs', 'Database'],
    features: ['Real-time updates', 'Custom charts', 'Export functionality', 'Mobile responsive'],
    use_cases: ['Business intelligence', 'Performance monitoring', 'Data visualization'],
    installation_time: 25,
    support_level: 'premium'
  }
]

// Mock collections for search
const mockCollections = [
  {
    id: 'collection-1',
    name: 'E-commerce Starter Pack',
    description: 'Complete collection of templates to launch your online store quickly. Includes inventory management, product catalogs, and analytics.',
    bundle_price: 79.99,
    template_count: 4,
    category: 'E-commerce',
    tags: ['e-commerce', 'starter', 'bundle', 'complete-solution'],
    average_rating: 4.7,
    total_installs: 234,
    creator: 'RP9 Team',
    created_at: '2024-10-15T10:00:00Z',
    templates: ['template-1', 'template-2'],
    difficulty: 'beginner',
    estimated_setup_time: 60
  },
  {
    id: 'collection-2',
    name: 'Marketing Automation Suite',
    description: 'Comprehensive marketing tools including email campaigns, lead scoring, and customer segmentation.',
    bundle_price: 129.99,
    template_count: 5,
    category: 'Marketing',
    tags: ['marketing', 'automation', 'campaigns', 'leads', 'comprehensive'],
    average_rating: 4.6,
    total_installs: 167,
    creator: 'Marketing Pro',
    created_at: '2024-10-20T09:15:00Z',
    templates: ['template-3', 'template-4'],
    difficulty: 'intermediate',
    estimated_setup_time: 120
  }
]

// Search ranking algorithm
function calculateRelevanceScore(item: any, query: string, filters: any) {
  let score = 0
  const queryLower = query.toLowerCase()
  
  // Name match (highest priority)
  if (item.name.toLowerCase().includes(queryLower)) {
    score += 100
    // Exact match bonus
    if (item.name.toLowerCase() === queryLower) {
      score += 50
    }
    // Start of name bonus
    if (item.name.toLowerCase().startsWith(queryLower)) {
      score += 25
    }
  }
  
  // Description match
  if (item.description.toLowerCase().includes(queryLower)) {
    score += 50
  }
  
  // Tags match
  const matchingTags = item.tags.filter((tag: string) => 
    tag.toLowerCase().includes(queryLower)
  ).length
  score += matchingTags * 30
  
  // Category match
  if (item.category.toLowerCase().includes(queryLower)) {
    score += 40
  }
  
  // Creator match
  if (item.creator.toLowerCase().includes(queryLower)) {
    score += 20
  }
  
  // Features match (for templates)
  if (item.features) {
    const matchingFeatures = item.features.filter((feature: string) =>
      feature.toLowerCase().includes(queryLower)
    ).length
    score += matchingFeatures * 15
  }
  
  // Use cases match (for templates)
  if (item.use_cases) {
    const matchingUseCases = item.use_cases.filter((useCase: string) =>
      useCase.toLowerCase().includes(queryLower)
    ).length
    score += matchingUseCases * 15
  }
  
  // Popularity bonus (install count)
  const installsBonus = Math.min(item.total_installs / 100, 50) // Cap at 50 points
  score += installsBonus
  
  // Rating bonus
  const ratingBonus = item.average_rating * 10
  score += ratingBonus
  
  // Recency bonus (newer items get slight boost)
  const ageInDays = (new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
  const recencyBonus = Math.max(0, 30 - (ageInDays / 10)) // Newer items get up to 30 points
  score += recencyBonus
  
  return score
}

// Apply filters to items
function applyFilters(items: any[], filters: any) {
  return items.filter(item => {
    // Category filter
    if (filters.category && filters.category !== 'all' && item.category !== filters.category) {
      return false
    }
    
    // Price range filter (for templates)
    if (filters.minPrice !== undefined && item.price < filters.minPrice) {
      return false
    }
    if (filters.maxPrice !== undefined && item.price > filters.maxPrice) {
      return false
    }
    
    // Rating filter
    if (filters.minRating !== undefined && item.average_rating < filters.minRating) {
      return false
    }
    
    // Premium/Free filter
    if (filters.priceType === 'free' && item.price > 0) {
      return false
    }
    if (filters.priceType === 'premium' && item.price === 0) {
      return false
    }
    
    // Difficulty filter (for templates)
    if (filters.difficulty && filters.difficulty !== 'all' && item.difficulty !== filters.difficulty) {
      return false
    }
    
    // Compatibility filter (for templates)
    if (filters.compatibility && item.compatibility) {
      const hasCompatibility = item.compatibility.some((comp: string) =>
        comp.toLowerCase().includes(filters.compatibility.toLowerCase())
      )
      if (!hasCompatibility) {
        return false
      }
    }
    
    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some((filterTag: string) =>
        item.tags.some((itemTag: string) =>
          itemTag.toLowerCase().includes(filterTag.toLowerCase())
        )
      )
      if (!hasMatchingTag) {
        return false
      }
    }
    
    // Installation time filter (for templates)
    if (filters.maxInstallTime !== undefined && item.installation_time > filters.maxInstallTime) {
      return false
    }
    
    // Support level filter
    if (filters.supportLevel && filters.supportLevel !== 'all' && item.support_level !== filters.supportLevel) {
      return false
    }
    
    return true
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Search parameters
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // all, templates, collections
    const sort = searchParams.get('sort') || 'relevance' // relevance, rating, installs, price, newest
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    // Filter parameters
    const category = searchParams.get('category')
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined
    const priceType = searchParams.get('priceType') // free, premium
    const difficulty = searchParams.get('difficulty')
    const compatibility = searchParams.get('compatibility')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
    const maxInstallTime = searchParams.get('maxInstallTime') ? parseInt(searchParams.get('maxInstallTime')!) : undefined
    const supportLevel = searchParams.get('supportLevel')
    
    const filters = {
      category,
      minPrice,
      maxPrice,
      minRating,
      priceType,
      difficulty,
      compatibility,
      tags,
      maxInstallTime,
      supportLevel
    }
    
    let results: any[] = []
    
    // Search in templates
    if (type === 'all' || type === 'templates') {
      let templates = [...mockTemplates]
      
      // Apply text search if query provided
      if (query.trim()) {
        templates = templates.filter(template => {
          const searchText = `${template.name} ${template.description} ${template.category} ${template.creator} ${template.tags.join(' ')} ${template.features?.join(' ') || ''} ${template.use_cases?.join(' ') || ''}`.toLowerCase()
          return searchText.includes(query.toLowerCase())
        })
        
        // Add relevance scores
        templates = templates.map(template => ({
          ...template,
          relevanceScore: calculateRelevanceScore(template, query, filters),
          type: 'template'
        }))
      } else {
        // No query, just add type and default score
        templates = templates.map(template => ({
          ...template,
          relevanceScore: template.total_installs / 100 + template.average_rating * 10,
          type: 'template'
        }))
      }
      
      // Apply filters
      templates = applyFilters(templates, filters)
      
      results.push(...templates)
    }
    
    // Search in collections
    if (type === 'all' || type === 'collections') {
      let collections = [...mockCollections]
      
      // Apply text search if query provided
      if (query.trim()) {
        collections = collections.filter(collection => {
          const searchText = `${collection.name} ${collection.description} ${collection.category} ${collection.creator} ${collection.tags.join(' ')}`.toLowerCase()
          return searchText.includes(query.toLowerCase())
        })
        
        // Add relevance scores
        collections = collections.map(collection => ({
          ...collection,
          relevanceScore: calculateRelevanceScore(collection, query, filters),
          type: 'collection'
        }))
      } else {
        // No query, just add type and default score
        collections = collections.map(collection => ({
          ...collection,
          relevanceScore: collection.total_installs / 100 + collection.average_rating * 10,
          type: 'collection'
        }))
      }
      
      // Apply filters (subset that apply to collections)
      const collectionFilters = {
        category: filters.category,
        minRating: filters.minRating,
        priceType: filters.priceType === 'free' ? 'free' : undefined, // Collections have bundle_price
        tags: filters.tags
      }
      
      collections = collections.filter(collection => {
        if (collectionFilters.category && collectionFilters.category !== 'all' && collection.category !== collectionFilters.category) {
          return false
        }
        if (collectionFilters.minRating !== undefined && collection.average_rating < collectionFilters.minRating) {
          return false
        }
        if (collectionFilters.priceType === 'free' && collection.bundle_price > 0) {
          return false
        }
        if (collectionFilters.tags && collectionFilters.tags.length > 0) {
          const hasMatchingTag = collectionFilters.tags.some((filterTag: string) =>
            collection.tags.some((itemTag: string) =>
              itemTag.toLowerCase().includes(filterTag.toLowerCase())
            )
          )
          if (!hasMatchingTag) {
            return false
          }
        }
        return true
      })
      
      results.push(...collections)
    }
    
    // Sort results
    switch (sort) {
      case 'rating':
        results.sort((a, b) => b.average_rating - a.average_rating)
        break
      case 'installs':
        results.sort((a, b) => b.total_installs - a.total_installs)
        break
      case 'price':
        results.sort((a, b) => {
          const aPrice = a.price || a.bundle_price || 0
          const bPrice = b.price || b.bundle_price || 0
          return aPrice - bPrice
        })
        break
      case 'newest':
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'relevance':
      default:
        results.sort((a, b) => b.relevanceScore - a.relevanceScore)
        break
    }
    
    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedResults = results.slice(startIndex, endIndex)
    const totalPages = Math.ceil(results.length / limit)
    
    // Generate search suggestions (if query is provided but no results)
    let suggestions: string[] = []
    if (query.trim() && results.length === 0) {
      // Generate suggestions based on available data
      const allTerms = [
        ...mockTemplates.flatMap(t => [t.name, t.category, ...t.tags]),
        ...mockCollections.flatMap(c => [c.name, c.category, ...c.tags])
      ]
      
      suggestions = allTerms
        .filter(term => term.toLowerCase().includes(query.toLowerCase().slice(0, -1)))
        .slice(0, 5)
    }
    
    // Analytics/meta information
    const resultCounts = {
      total: results.length,
      templates: results.filter(r => r.type === 'template').length,
      collections: results.filter(r => r.type === 'collection').length
    }
    
    const categories = [...new Set(results.map(r => r.category))]
    const priceRange = {
      min: Math.min(...results.map(r => r.price || r.bundle_price || 0)),
      max: Math.max(...results.map(r => r.price || r.bundle_price || 0))
    }
    
    return NextResponse.json({
      success: true,
      data: {
        results: paginatedResults,
        suggestions,
        facets: {
          categories,
          priceRange,
          resultCounts
        },
        pagination: {
          page,
          limit,
          total: results.length,
          pages: totalPages,
          hasNext: endIndex < results.length,
          hasPrev: page > 1
        },
        query: {
          q: query,
          type,
          sort,
          filters: Object.fromEntries(
            Object.entries(filters).filter(([_, value]) => 
              value !== undefined && value !== null && value !== 'all'
            )
          ),
          appliedFiltersCount: Object.values(filters).filter(v => 
            v !== undefined && v !== null && v !== 'all' && 
            (Array.isArray(v) ? v.length > 0 : true)
          ).length
        }
      },
      meta: {
        searchTime: Date.now(), // In real app, measure actual search time
        totalAvailable: mockTemplates.length + mockCollections.length
      }
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    )
  }
}