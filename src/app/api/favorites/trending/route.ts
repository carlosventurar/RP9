/**
 * Trending Favorites API
 * Get trending/popular templates and collections based on favorites
 * Sprint 3.4: Sistema de Template Favorites
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock trending data based on recent favorites activity
const mockTrendingTemplates = [
  {
    template_id: 'template-1',
    template_name: 'Multi-Channel Inventory Sync Pro',
    template_category: 'E-commerce',
    template_price: 35.00,
    template_rating: 4.8,
    template_installs: 2456,
    favorite_count: 156,
    recent_favorites: 23, // favorites in last 7 days
    growth_percentage: 18.5,
    image_url: '/images/templates/inventory-sync.jpg'
  },
  {
    template_id: 'template-3',
    template_name: 'Advanced Lead Scoring AI Pro',
    template_category: 'CRM & Sales',
    template_price: 50.00,
    template_rating: 4.9,
    template_installs: 1523,
    favorite_count: 134,
    recent_favorites: 19,
    growth_percentage: 16.5,
    image_url: '/images/templates/lead-scoring.jpg'
  },
  {
    template_id: 'template-5',
    template_name: 'Email Notification System',
    template_category: 'Communication',
    template_price: 0,
    template_rating: 4.4,
    template_installs: 5234,
    favorite_count: 289,
    recent_favorites: 15,
    growth_percentage: 12.3,
    image_url: '/images/templates/email-system.jpg'
  },
  {
    template_id: 'template-2',
    template_name: 'Advanced Product Catalog Manager',
    template_category: 'E-commerce',
    template_price: 29.99,
    template_rating: 4.6,
    template_installs: 1834,
    favorite_count: 98,
    recent_favorites: 12,
    growth_percentage: 14.8,
    image_url: '/images/templates/catalog-manager.jpg'
  },
  {
    template_id: 'template-mkt-1',
    template_name: 'Email Campaign Manager',
    template_category: 'Marketing',
    template_price: 39.99,
    template_rating: 4.8,
    template_installs: 2834,
    favorite_count: 87,
    recent_favorites: 11,
    growth_percentage: 15.2,
    image_url: '/images/templates/email-campaigns.jpg'
  }
]

const mockTrendingCollections = [
  {
    collection_id: 'collection-1',
    collection_name: 'E-commerce Starter Pack',
    bundle_price: 79.99,
    discount_percentage: 25.0,
    template_count: 4,
    collection_rating: 4.7,
    collection_installs: 234,
    favorite_count: 67,
    recent_favorites: 8,
    growth_percentage: 22.4,
    image_url: '/images/collections/ecommerce-starter.jpg'
  },
  {
    collection_id: 'collection-4',
    collection_name: 'Free Getting Started Collection',
    bundle_price: null,
    discount_percentage: 0,
    template_count: 3,
    collection_rating: 4.3,
    collection_installs: 892,
    favorite_count: 156,
    recent_favorites: 7,
    growth_percentage: 8.9,
    image_url: '/images/collections/getting-started.jpg'
  },
  {
    collection_id: 'collection-2',
    collection_name: 'Marketing Automation Suite',
    bundle_price: 129.99,
    discount_percentage: 30.0,
    template_count: 5,
    collection_rating: 4.6,
    collection_installs: 167,
    favorite_count: 45,
    recent_favorites: 6,
    growth_percentage: 18.7,
    image_url: '/images/collections/marketing-suite.jpg'
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'both' // templates, collections, both
    const timeframe = searchParams.get('timeframe') || '7d' // 24h, 7d, 30d
    const category = searchParams.get('category') // filter by category
    const limit = parseInt(searchParams.get('limit') || '10')

    // Convert timeframe to days
    const timeframeDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30
    }[timeframe] || 7

    let trending = {
      templates: [],
      collections: []
    }

    // Get trending templates
    if (type === 'templates' || type === 'both') {
      let templates = [...mockTrendingTemplates]

      // Filter by category if specified
      if (category && category !== 'all') {
        templates = templates.filter(t => t.template_category === category)
      }

      // Sort by growth percentage and recent favorites
      templates.sort((a, b) => {
        // Primary sort: recent favorites (more recent activity = higher priority)
        if (b.recent_favorites !== a.recent_favorites) {
          return b.recent_favorites - a.recent_favorites
        }
        // Secondary sort: growth percentage
        return b.growth_percentage - a.growth_percentage
      })

      trending.templates = templates.slice(0, limit)
    }

    // Get trending collections
    if (type === 'collections' || type === 'both') {
      let collections = [...mockTrendingCollections]

      // Sort by growth percentage and recent favorites
      collections.sort((a, b) => {
        // Primary sort: recent favorites
        if (b.recent_favorites !== a.recent_favorites) {
          return b.recent_favorites - a.recent_favorites
        }
        // Secondary sort: growth percentage
        return b.growth_percentage - a.growth_percentage
      })

      trending.collections = collections.slice(0, limit)
    }

    // Calculate summary stats
    const totalTrendingTemplates = mockTrendingTemplates.length
    const totalTrendingCollections = mockTrendingCollections.length
    const totalRecentFavorites = [
      ...mockTrendingTemplates.map(t => t.recent_favorites),
      ...mockTrendingCollections.map(c => c.recent_favorites)
    ].reduce((sum, count) => sum + count, 0)

    const avgGrowth = [
      ...trending.templates.map(t => t.growth_percentage),
      ...trending.collections.map(c => c.growth_percentage)
    ].reduce((sum, growth, _, arr) => sum + growth / arr.length, 0)

    return NextResponse.json({
      success: true,
      data: {
        trending,
        summary: {
          timeframe,
          total_trending_templates: totalTrendingTemplates,
          total_trending_collections: totalTrendingCollections,
          total_recent_favorites: totalRecentFavorites,
          average_growth_percentage: Math.round(avgGrowth * 10) / 10
        },
        filters: {
          type,
          timeframe,
          category: category || 'all',
          limit
        }
      },
      meta: {
        description: `Trending ${type} based on favorite activity in the last ${timeframe}`,
        updated_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Trending favorites API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trending favorites' },
      { status: 500 }
    )
  }
}