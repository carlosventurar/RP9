import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createN8nClient } from '@/lib/n8n'

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const n8nClient = createN8nClient(user.tenantId)
    const result = await n8nClient.runWorkflow(params.id, body)

    return NextResponse.json({
      success: true,
      data: result,
      tenant: user.tenantId
    })
  } catch (error) {
    console.error(`Workflow run ${params.id} error:`, error)
    return NextResponse.json(
      { error: 'Failed to run workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}