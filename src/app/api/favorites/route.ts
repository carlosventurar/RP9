/**
 * User Favorites API
 * Handles user favorite templates and collections
 * Sprint 3.4: Sistema de Template Favorites
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock favorites data (replace with real database)
const mockTemplateFavorites = [
  { id: 'fav-1', user_id: 'user-1', template_id: 'template-1', created_at: '2024-11-01T10:00:00Z' },
  { id: 'fav-2', user_id: 'user-1', template_id: 'template-3', created_at: '2024-10-28T14:30:00Z' },
  { id: 'fav-3', user_id: 'user-1', template_id: 'template-5', created_at: '2024-10-25T09:15:00Z' },
  { id: 'fav-4', user_id: 'user-2', template_id: 'template-1', created_at: '2024-10-30T16:45:00Z' },
  { id: 'fav-5', user_id: 'user-2', template_id: 'template-2', created_at: '2024-10-29T11:20:00Z' },
]

const mockCollectionFavorites = [
  { id: 'cfav-1', user_id: 'user-1', collection_id: 'collection-1', created_at: '2024-11-02T08:30:00Z' },
  { id: 'cfav-2', user_id: 'user-1', collection_id: 'collection-4', created_at: '2024-10-26T15:45:00Z' },
  { id: 'cfav-3', user_id: 'user-2', collection_id: 'collection-2', created_at: '2024-10-31T12:00:00Z' },
]

// Mock templates data for favorites
const mockTemplates = [
  {
    id: 'template-1',
    name: 'Multi-Channel Inventory Sync Pro',
    description: 'Synchronize inventory across multiple sales channels in real-time.',
    price: 35.00,
    category: 'E-commerce',
    is_premium: true,
    average_rating: 4.8,
    total_installs: 2456,
    image_url: '/images/templates/inventory-sync.jpg',
    created_at: '2024-09-15T10:00:00Z'
  },
  {
    id: 'template-2',
    name: 'Advanced Product Catalog Manager',
    description: 'Comprehensive product catalog management with advanced filtering.',
    price: 29.99,
    category: 'E-commerce',
    is_premium: true,
    average_rating: 4.6,
    total_installs: 1834,
    image_url: '/images/templates/catalog-manager.jpg',
    created_at: '2024-09-20T14:30:00Z'
  },
  {
    id: 'template-3',
    name: 'Advanced Lead Scoring AI Pro',
    description: 'AI-powered lead scoring system with machine learning algorithms.',
    price: 50.00,
    category: 'CRM & Sales',
    is_premium: true,
    average_rating: 4.9,
    total_installs: 1523,
    image_url: '/images/templates/lead-scoring.jpg',
    created_at: '2024-09-25T09:15:00Z'
  },
  {
    id: 'template-5',
    name: 'Email Notification System',
    description: 'Reliable email notification system with template support.',
    price: 0,
    category: 'Communication',
    is_premium: false,
    average_rating: 4.4,
    total_installs: 5234,
    image_url: '/images/templates/email-system.jpg',
    created_at: '2024-08-10T16:45:00Z'
  }
]

// Mock collections data for favorites
const mockCollections = [
  {
    id: 'collection-1',
    name: 'E-commerce Starter Pack',
    description: 'Complete collection of templates to launch your online store quickly.',
    bundle_price: 79.99,
    discount_percentage: 25.0,
    template_count: 4,
    average_rating: 4.7,
    total_installs: 234,
    image_url: '/images/collections/ecommerce-starter.jpg'
  },
  {
    id: 'collection-2',
    name: 'Marketing Automation Suite',
    description: 'Comprehensive marketing tools including email campaigns and lead scoring.',
    bundle_price: 129.99,
    discount_percentage: 30.0,
    template_count: 5,
    average_rating: 4.6,
    total_installs: 167,
    image_url: '/images/collections/marketing-suite.jpg'
  },
  {
    id: 'collection-4',
    name: 'Free Getting Started Collection',
    description: 'Essential templates to get started with the platform.',
    bundle_price: null,
    discount_percentage: 0,
    template_count: 3,
    average_rating: 4.3,
    total_installs: 892,
    image_url: '/images/collections/getting-started.jpg'
  }
]

export async function GET(request: NextRequest) {
  try {
    // Check authentication (mock)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'both' // templates, collections, both
    const sort = searchParams.get('sort') || 'recent' // recent, name, category, rating
    const category = searchParams.get('category') // filter by category
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')

    // Mock current user ID from token
    const currentUserId = 'user-1' // From auth token

    let favorites = {
      templates: [],
      collections: []
    }

    // Get template favorites
    if (type === 'templates' || type === 'both') {
      const userTemplateFavorites = mockTemplateFavorites
        .filter(fav => fav.user_id === currentUserId)
        .map(fav => {
          const template = mockTemplates.find(t => t.id === fav.template_id)
          return template ? {
            favorite_id: fav.id,
            favorited_at: fav.created_at,
            ...template
          } : null
        })
        .filter(Boolean)

      favorites.templates = userTemplateFavorites
    }

    // Get collection favorites
    if (type === 'collections' || type === 'both') {
      const userCollectionFavorites = mockCollectionFavorites
        .filter(fav => fav.user_id === currentUserId)
        .map(fav => {
          const collection = mockCollections.find(c => c.id === fav.collection_id)
          return collection ? {
            favorite_id: fav.id,
            favorited_at: fav.created_at,
            ...collection
          } : null
        })
        .filter(Boolean)

      favorites.collections = userCollectionFavorites
    }

    // Apply category filter
    if (category && category !== 'all') {
      favorites.templates = favorites.templates.filter(t => t.category === category)
    }

    // Apply sorting
    const sortFn = (a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'category':
          return a.category?.localeCompare(b.category || '') || 0
        case 'rating':
          return (b.average_rating || 0) - (a.average_rating || 0)
        case 'recent':
        default:
          return new Date(b.favorited_at).getTime() - new Date(a.favorited_at).getTime()
      }
    }

    favorites.templates.sort(sortFn)
    favorites.collections.sort(sortFn)

    // Calculate total for pagination
    const totalTemplates = favorites.templates.length
    const totalCollections = favorites.collections.length
    const totalFavorites = totalTemplates + totalCollections

    // Apply pagination to combined results if needed
    let paginatedFavorites = favorites
    if (type === 'both') {
      // For combined results, merge and paginate together
      const combined = [
        ...favorites.templates.map(t => ({ ...t, type: 'template' })),
        ...favorites.collections.map(c => ({ ...c, type: 'collection' }))
      ].sort(sortFn)

      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedCombined = combined.slice(startIndex, endIndex)

      paginatedFavorites = {
        templates: paginatedCombined.filter(item => item.type === 'template'),
        collections: paginatedCombined.filter(item => item.type === 'collection')
      }
    } else {
      // Paginate individual types
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      
      if (type === 'templates') {
        paginatedFavorites.templates = favorites.templates.slice(startIndex, endIndex)
      } else if (type === 'collections') {
        paginatedFavorites.collections = favorites.collections.slice(startIndex, endIndex)
      }
    }

    // Calculate statistics
    const stats = {
      total_template_favorites: totalTemplates,
      total_collection_favorites: totalCollections,
      total_favorites: totalFavorites,
      favorite_categories: [...new Set(favorites.templates.map(t => t.category))],
      most_favorited_category: favorites.templates.length > 0 
        ? favorites.templates.reduce((acc, template) => {
            acc[template.category] = (acc[template.category] || 0) + 1
            return acc
          }, {})
        : {}
    }

    // Find most favorited category
    if (Object.keys(stats.most_favorited_category).length > 0) {
      const mostFavorited = Object.entries(stats.most_favorited_category)
        .reduce((a, b) => a[1] > b[1] ? a : b)[0]
      stats.most_favorited_category = mostFavorited
    } else {
      stats.most_favorited_category = null
    }

    return NextResponse.json({
      success: true,
      data: {
        favorites: paginatedFavorites,
        stats,
        pagination: {
          page,
          limit,
          total: type === 'templates' ? totalTemplates : 
                 type === 'collections' ? totalCollections : 
                 totalFavorites,
          pages: Math.ceil((type === 'templates' ? totalTemplates : 
                           type === 'collections' ? totalCollections : 
                           totalFavorites) / limit),
          hasNext: type === 'templates' ? (page * limit < totalTemplates) :
                   type === 'collections' ? (page * limit < totalCollections) :
                   (page * limit < totalFavorites),
          hasPrev: page > 1
        },
        filters: {
          type,
          sort,
          category: category || 'all'
        }
      }
    })
  } catch (error) {
    console.error('Favorites API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication (mock)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { item_id, item_type } = body // template_id or collection_id, 'template' or 'collection'

    // Validation
    if (!item_id || !item_type) {
      return NextResponse.json(
        { success: false, error: 'Item ID and type are required' },
        { status: 400 }
      )
    }

    if (!['template', 'collection'].includes(item_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid item type. Must be "template" or "collection"' },
        { status: 400 }
      )
    }

    // Mock current user ID from token
    const currentUserId = 'user-current' // From auth token

    // Check if already favorited (mock)
    const existingFavorite = item_type === 'template'
      ? mockTemplateFavorites.find(fav => fav.user_id === currentUserId && fav.template_id === item_id)
      : mockCollectionFavorites.find(fav => fav.user_id === currentUserId && fav.collection_id === item_id)

    if (existingFavorite) {
      return NextResponse.json(
        { success: false, error: 'Item already favorited' },
        { status: 400 }
      )
    }

    // Verify item exists (mock)
    const itemExists = item_type === 'template'
      ? mockTemplates.find(t => t.id === item_id)
      : mockCollections.find(c => c.id === item_id)

    if (!itemExists) {
      return NextResponse.json(
        { success: false, error: `${item_type.charAt(0).toUpperCase() + item_type.slice(1)} not found` },
        { status: 404 }
      )
    }

    // Create new favorite (mock)
    const newFavorite = {
      id: `fav-${Date.now()}`,
      user_id: currentUserId,
      [item_type === 'template' ? 'template_id' : 'collection_id']: item_id,
      created_at: new Date().toISOString()
    }

    // In real implementation:
    // 1. Insert into appropriate favorites table
    // 2. Return the created favorite

    return NextResponse.json({
      success: true,
      data: { favorite: newFavorite },
      message: `${item_type.charAt(0).toUpperCase() + item_type.slice(1)} added to favorites`
    }, { status: 201 })

  } catch (error) {
    console.error('Add favorite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add favorite' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication (mock)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { item_id, item_type } = body // template_id or collection_id, 'template' or 'collection'

    // Validation
    if (!item_id || !item_type) {
      return NextResponse.json(
        { success: false, error: 'Item ID and type are required' },
        { status: 400 }
      )
    }

    if (!['template', 'collection'].includes(item_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid item type. Must be "template" or "collection"' },
        { status: 400 }
      )
    }

    // Mock current user ID from token
    const currentUserId = 'user-current' // From auth token

    // Find existing favorite (mock)
    const existingFavorite = item_type === 'template'
      ? mockTemplateFavorites.find(fav => fav.user_id === currentUserId && fav.template_id === item_id)
      : mockCollectionFavorites.find(fav => fav.user_id === currentUserId && fav.collection_id === item_id)

    if (!existingFavorite) {
      return NextResponse.json(
        { success: false, error: 'Favorite not found' },
        { status: 404 }
      )
    }

    // In real implementation:
    // 1. Delete from appropriate favorites table
    // 2. Return success message

    return NextResponse.json({
      success: true,
      message: `${item_type.charAt(0).toUpperCase() + item_type.slice(1)} removed from favorites`
    })

  } catch (error) {
    console.error('Remove favorite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove favorite' },
      { status: 500 }
    )
  }
}