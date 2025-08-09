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
    const active = searchParams.get('active')

    const n8nClient = createN8nClient(user.tenantId)
    const workflows = await n8nClient.getWorkflows({
      active: active ? active === 'true' : undefined
    })

    return NextResponse.json({
      success: true,
      data: workflows,
      tenant: user.tenantId
    })
  } catch (error) {
    console.error('Workflows GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { workflow } = body

    if (!workflow || !workflow.name || !Array.isArray(workflow.nodes)) {
      return NextResponse.json(
        { error: 'Invalid workflow: requires name and nodes array' },
        { status: 400 }
      )
    }

    const n8nClient = createN8nClient(user.tenantId)

    // Check if workflow exists by name (upsert behavior)
    const existingWorkflows = await n8nClient.getWorkflows({ limit: 250 } as any)
    const existingWorkflow = existingWorkflows.find(w => w.name === workflow.name)

    let result
    if (existingWorkflow) {
      result = await n8nClient.updateWorkflow(existingWorkflow.id!, workflow)
    } else {
      result = await n8nClient.createWorkflow(workflow)
    }

    return NextResponse.json({
      success: true,
      data: result,
      tenant: user.tenantId
    })
  } catch (error) {
    console.error('Workflows POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create/update workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}