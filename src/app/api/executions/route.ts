import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createN8nClient } from '@/lib/n8n'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const workflowId = searchParams.get('workflowId')
    const limit = searchParams.get('limit')
    const lastId = searchParams.get('lastId')

    const n8nClient = createN8nClient(user.tenantId)
    const executions = await n8nClient.getExecutions({
      status: status || undefined,
      workflowId: workflowId || undefined,
      limit: limit ? parseInt(limit) : undefined,
      lastId: lastId || undefined,
    })

    return NextResponse.json({
      success: true,
      data: executions,
      tenant: user.tenantId
    })
  } catch (error) {
    console.error('Executions GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch executions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}