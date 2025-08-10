import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Check authentication (mock for now)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    const body = await request.json()
    const { templateId, customName } = body
    
    if (!templateId) {
      return NextResponse.json({
        success: false,
        error: 'Template ID is required'
      }, { status: 400 })
    }
    
    // Mock installation success
    const mockWorkflowId = `workflow_${Date.now()}`
    
    return NextResponse.json({
      success: true,
      data: {
        workflowId: mockWorkflowId,
        workflowName: customName || `Template ${templateId}`,
        n8nUrl: process.env.N8N_BASE_URL + `/workflow/${mockWorkflowId}`,
        message: 'Template installed successfully'
      }
    })
    
  } catch (error) {
    console.error('Template install API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to install template'
    }, { status: 500 })
  }
}