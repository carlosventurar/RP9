import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get n8n credentials from environment
    const n8nUrl = process.env.N8N_BASE_URL
    const n8nApiKey = process.env.N8N_API_KEY

    if (!n8nUrl || !n8nApiKey) {
      return NextResponse.json(
        { error: 'N8N configuration missing' },
        { status: 500 }
      )
    }

    // Fetch workflows directly from n8n with timeout and retry logic
    let response
    let workflows
    let attempts = 0
    const maxAttempts = 2
    
    while (attempts < maxAttempts) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        response = await fetch(`${n8nUrl}/api/v1/workflows`, {
          headers: {
            'X-N8N-API-KEY': n8nApiKey,
            'Accept': 'application/json'
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`N8N API error: ${response.status} ${response.statusText}`)
        }

        workflows = await response.json()
        break // Success, exit retry loop
        
      } catch (error) {
        attempts++
        console.error(`N8N API attempt ${attempts} failed:`, error)
        
        if (attempts >= maxAttempts) {
          // Return fallback data if all attempts fail
          console.warn('N8N API unavailable, returning fallback data')
          return NextResponse.json({
            success: true,
            data: [], // Empty array as fallback
            total: 0,
            tags: [],
            fallback: true,
            error: 'N8N API temporarily unavailable'
          })
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Transform workflows to match our interface and add smart tags based on workflow names
    const transformedWorkflows = workflows.data.map((workflow: any) => {
      // Smart tag assignment based on workflow names and content
      let smartTags: string[] = []
      const name = workflow.name.toLowerCase()
      
      if (name.includes('clickup') || name.includes('task')) smartTags.push('productivity')
      if (name.includes('google') || name.includes('sheets')) smartTags.push('google-workspace')
      if (name.includes('error') || name.includes('trigger')) smartTags.push('monitoring')
      if (name.includes('scrape') || name.includes('scraper')) smartTags.push('scraping')
      if (name.includes('linkedin') || name.includes('jobs')) smartTags.push('hr', 'linkedin')
      if (name.includes('eerr') || name.includes('finanzas') || name.includes('presupuesto')) smartTags.push('finance', 'reporting')
      if (name.includes('crossnet')) smartTags.push('crossnet', 'business')
      if (name.includes('webhook')) smartTags.push('api', 'webhooks')
      if (name.includes('telegram')) smartTags.push('notifications', 'telegram')
      if (name.includes('aws') || name.includes('lambda')) smartTags.push('aws', 'cloud')
      if (name.includes('email') || name.includes('ses')) smartTags.push('email', 'notifications')
      
      // Use n8n tags if available, otherwise use smart tags
      const finalTags = (workflow.tags && workflow.tags.length > 0) ? workflow.tags : smartTags
      
      return {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        nodes: workflow.nodes || [],
        tags: finalTags,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        lastExecution: getRelativeTime(workflow.updatedAt),
        executionCount: Math.floor(Math.random() * 1000) + 100, // Mock for now
        successRate: Math.floor(Math.random() * 10) + 90 // Mock for now
      }
    })

    // Extract all unique tags from workflows
    const allTags = new Set<string>()
    transformedWorkflows.forEach((workflow: any) => {
      if (workflow.tags && Array.isArray(workflow.tags)) {
        workflow.tags.forEach((tag: string) => allTags.add(tag))
      }
    })

    const uniqueTags = Array.from(allTags).sort()

    return NextResponse.json({
      success: true,
      data: transformedWorkflows,
      total: workflows.data.length,
      tags: uniqueTags
    })

  } catch (error) {
    console.error('N8N Workflows fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows from n8n', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function getRelativeTime(dateString: string): string {
  if (!dateString) return 'Never'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}