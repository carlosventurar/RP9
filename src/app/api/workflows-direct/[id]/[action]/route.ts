import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    id: string
    action: 'activate' | 'deactivate' | 'run'
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, action } = params
    
    // Get n8n credentials from environment
    const n8nUrl = process.env.N8N_BASE_URL
    const n8nApiKey = process.env.N8N_API_KEY

    if (!n8nUrl || !n8nApiKey) {
      return NextResponse.json(
        { error: 'N8N configuration missing' },
        { status: 500 }
      )
    }

    let response
    let endpoint
    let method = 'POST'
    let body = {}

    switch (action) {
      case 'activate':
        endpoint = `${n8nUrl}/api/v1/workflows/${id}/activate`
        break
      case 'deactivate': 
        endpoint = `${n8nUrl}/api/v1/workflows/${id}/activate`
        method = 'DELETE'
        break
      case 'run':
        endpoint = `${n8nUrl}/api/v1/workflows/${id}/execute`
        body = { triggerData: {} }
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    response = await fetch(endpoint, {
      method,
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      ...(Object.keys(body).length > 0 && { body: JSON.stringify(body) })
    })

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status} - ${response.statusText}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      data: result,
      action: action,
      workflowId: id
    })

  } catch (error) {
    console.error(`N8N ${params.action} error:`, error)
    return NextResponse.json(
      { error: `Failed to ${params.action} workflow`, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}