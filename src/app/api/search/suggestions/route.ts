/**
 * Search Suggestions API
 * Provides autocomplete suggestions for search queries
 * Sprint 3.5: Template Search Avanzado
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock data for suggestions (in real app, this would come from database or search index)
const searchTerms = [
  // Template names
  'Multi-Channel Inventory Sync Pro',
  'Advanced Product Catalog Manager', 
  'Advanced Lead Scoring AI Pro',
  'Cross-Platform Campaign Manager',
  'Email Notification System',
  'Real-Time Analytics Dashboard',
  
  // Categories
  'E-commerce',
  'CRM & Sales',
  'Marketing',
  'Communication',
  'Analytics',
  'DevOps & IT',
  'Productivity',
  'Finance',
  
  // Popular keywords
  'inventory management',
  'lead scoring',
  'email campaigns',
  'analytics dashboard',
  'automation',
  'artificial intelligence',
  'machine learning',
  'real-time sync',
  'multi-channel',
  'campaign manager',
  'notification system',
  'product catalog',
  'sales pipeline',
  'marketing automation',
  'customer segmentation',
  'social media',
  'integration',
  'API',
  'dashboard',
  'reporting',
  'tracking',
  'optimization',
  'conversion',
  'engagement',
  'personalization',
  'workflow',
  'collaboration',
  'security',
  'backup',
  'monitoring',
  'deployment',
  'database',
  'mobile',
  'responsive',
  'cloud',
  'saas',
  
  // Technology/Platform terms
  'Shopify',
  'WooCommerce',
  'Magento',
  'Salesforce',
  'HubSpot',
  'Pipedrive',
  'Google Analytics',
  'Facebook Ads',
  'Google Ads',
  'LinkedIn',
  'Twitter',
  'SendGrid',
  'Mailgun',
  'AWS',
  'Stripe',
  'PayPal',
  'Zapier',
  'Slack',
  'Microsoft Teams',
  
  // Feature terms
  'free template',
  'premium template',
  'beginner friendly',
  'advanced features',
  'easy setup',
  'quick install',
  'no code',
  'drag and drop',
  'customizable',
  'white label',
  'multi language',
  'mobile responsive',
  'SEO optimized',
  'GDPR compliant',
  'enterprise ready',
  'scalable',
  'secure',
  'fast',
  'reliable',
  'supported'
]

// Popular search queries (based on user behavior)
const popularQueries = [
  'inventory sync',
  'email automation',
  'lead scoring',
  'analytics dashboard',
  'marketing campaigns',
  'crm integration',
  'e-commerce tools',
  'free templates',
  'ai powered',
  'real-time tracking',
  'mobile friendly',
  'easy setup',
  'shopify apps',
  'salesforce integration',
  'google analytics'
]

// Trending searches (would be updated based on recent activity)
const trendingQueries = [
  'ai templates',
  'automation workflows',
  'multi-channel sync',
  'campaign optimization',
  'conversion tracking',
  'customer analytics',
  'social media tools',
  'mobile apps'
]

function calculateSuggestionScore(term: string, query: string): number {
  const termLower = term.toLowerCase()
  const queryLower = query.toLowerCase()
  
  let score = 0
  
  // Exact match (highest priority)
  if (termLower === queryLower) {
    score += 1000
  }
  
  // Starts with query (very high priority)
  if (termLower.startsWith(queryLower)) {
    score += 500
  }
  
  // Contains query as whole word
  const regex = new RegExp(`\\b${queryLower}\\b`, 'i')
  if (regex.test(termLower)) {
    score += 300
  }
  
  // Contains query anywhere
  if (termLower.includes(queryLower)) {
    score += 100
  }
  
  // Fuzzy matching for typos (simple version)
  if (queryLower.length > 2) {
    const chars = queryLower.split('')
    const matchingChars = chars.filter(char => termLower.includes(char)).length
    const fuzzyScore = (matchingChars / queryLower.length) * 50
    score += fuzzyScore
  }
  
  // Boost popular terms
  if (popularQueries.includes(termLower)) {
    score += 50
  }
  
  // Boost trending terms
  if (trendingQueries.includes(termLower)) {
    score += 30
  }
  
  // Penalize very long terms (prefer concise suggestions)
  if (term.length > 30) {
    score -= 10
  }
  
  return score
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '8')
    const includePopular = searchParams.get('includePopular') === 'true'
    const includeTrending = searchParams.get('includeTrending') === 'true'
    
    if (!query.trim()) {
      // Return popular and trending suggestions when no query
      const suggestions: any[] = []
      
      if (includePopular) {
        suggestions.push(...popularQueries.slice(0, 5).map(q => ({
          text: q,
          type: 'popular',
          score: 0
        })))
      }
      
      if (includeTrending) {
        suggestions.push(...trendingQueries.slice(0, 3).map(q => ({
          text: q,
          type: 'trending',
          score: 0
        })))
      }
      
      return NextResponse.json({
        success: true,
        data: {
          suggestions: suggestions.slice(0, limit),
          query: '',
          popular: popularQueries.slice(0, 5),
          trending: trendingQueries.slice(0, 3)
        }
      })
    }
    
    // Filter and score suggestions based on query
    const scoredSuggestions = searchTerms
      .map(term => ({
        text: term,
        type: 'suggestion' as const,
        score: calculateSuggestionScore(term, query)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
    
    // Add category suggestions
    const categories = ['E-commerce', 'CRM & Sales', 'Marketing', 'Communication', 'Analytics', 'DevOps & IT']
    const categorySuggestions = categories
      .filter(cat => cat.toLowerCase().includes(query.toLowerCase()))
      .map(cat => ({
        text: cat,
        type: 'category' as const,
        score: calculateSuggestionScore(cat, query)
      }))
    
    // Combine and deduplicate
    const allSuggestions = [...scoredSuggestions, ...categorySuggestions]
      .sort((a, b) => b.score - a.score)
      .filter((item, index, self) => 
        index === self.findIndex(other => other.text.toLowerCase() === item.text.toLowerCase())
      )
      .slice(0, limit)
    
    // Add query completion suggestions (partial matches that complete the query)
    const completions = searchTerms
      .filter(term => 
        term.toLowerCase().startsWith(query.toLowerCase()) && 
        term.toLowerCase() !== query.toLowerCase()
      )
      .slice(0, 3)
      .map(term => ({
        text: term,
        type: 'completion' as const,
        score: 200 // Fixed score for completions
      }))
    
    const finalSuggestions = [...completions, ...allSuggestions]
      .filter((item, index, self) => 
        index === self.findIndex(other => other.text.toLowerCase() === item.text.toLowerCase())
      )
      .slice(0, limit)
    
    // Generate search metadata
    const hasExactMatch = searchTerms.some(term => 
      term.toLowerCase() === query.toLowerCase()
    )
    
    const partialMatches = searchTerms.filter(term =>
      term.toLowerCase().includes(query.toLowerCase())
    ).length
    
    return NextResponse.json({
      success: true,
      data: {
        suggestions: finalSuggestions,
        query: query.trim(),
        meta: {
          hasExactMatch,
          partialMatches,
          suggestionCount: finalSuggestions.length
        },
        popular: includePopular ? popularQueries.slice(0, 5) : [],
        trending: includeTrending ? trendingQueries.slice(0, 3) : []
      }
    })
  } catch (error) {
    console.error('Search suggestions API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}