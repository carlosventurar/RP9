import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, logAuditEvent } from '@/lib/auth/supabase-auth'
import { createN8nClient, filterWorkflowsByTenant } from '@/lib/n8n'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')

    const n8nClient = await createN8nClient(user.tenantId)
    const allWorkflows = await n8nClient.getWorkflows({
      active: active ? active === 'true' : undefined
    })

    // Filtrar workflows según configuración del tenant
    const filteredWorkflows = await filterWorkflowsByTenant(allWorkflows, user.tenantId)

    // Log audit event
    await logAuditEvent(
      user.tenantId,
      user.id,
      'list',
      'workflows',
      undefined,
      { count: filteredWorkflows.length, active: active },
      request.ip,
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json({
      success: true,
      data: filteredWorkflows,
      tenant: user.tenantId,
      total: allWorkflows.length,
      filtered: filteredWorkflows.length
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
    const user = await getAuthUser(request)
    
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

    const n8nClient = await createN8nClient(user.tenantId)

    // Check if workflow exists by name (upsert behavior)
    const allWorkflows = await n8nClient.getWorkflows({ limit: 250 } as any)
    const filteredWorkflows = await filterWorkflowsByTenant(allWorkflows, user.tenantId)
    const existingWorkflow = filteredWorkflows.find(w => w.name === workflow.name)

    let result
    let action = 'create'
    if (existingWorkflow) {
      result = await n8nClient.updateWorkflow(existingWorkflow.id!, workflow)
      action = 'update'
    } else {
      result = await n8nClient.createWorkflow(workflow)
    }

    // Log audit event
    await logAuditEvent(
      user.tenantId,
      user.id,
      action,
      'workflow',
      result.id,
      { name: workflow.name, nodes_count: workflow.nodes.length },
      request.ip,
      request.headers.get('user-agent') || undefined
    )

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