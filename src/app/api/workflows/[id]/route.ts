import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createN8nClient } from '@/lib/n8n'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const n8nClient = createN8nClient(user.tenantId)
    const workflow = await n8nClient.getWorkflow(params.id)

    return NextResponse.json({
      success: true,
      data: workflow,
      tenant: user.tenantId
    })
  } catch (error) {
    console.error(`Workflow GET ${params.id} error:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const workflow = await n8nClient.updateWorkflow(params.id, body)

    return NextResponse.json({
      success: true,
      data: workflow,
      tenant: user.tenantId
    })
  } catch (error) {
    console.error(`Workflow PATCH ${params.id} error:`, error)
    return NextResponse.json(
      { error: 'Failed to update workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const n8nClient = createN8nClient(user.tenantId)
    await n8nClient.deleteWorkflow(params.id)

    return NextResponse.json({
      success: true,
      tenant: user.tenantId
    })
  } catch (error) {
    console.error(`Workflow DELETE ${params.id} error:`, error)
    return NextResponse.json(
      { error: 'Failed to delete workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}