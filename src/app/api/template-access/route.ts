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
    const { templateIds } = body
    
    if (!templateIds || !Array.isArray(templateIds)) {
      return NextResponse.json({
        success: false,
        error: 'Template IDs array is required'
      }, { status: 400 })
    }
    
    // Mock access check - free templates (ID < 100) are accessible, premium templates require purchase
    const accessStatus = templateIds.map(id => {
      const numericId = parseInt(id)
      return {
        template_id: id,
        has_access: numericId < 100, // Free templates
        purchase_required: numericId >= 100
      }
    })
    
    return NextResponse.json({
      success: true,
      data: accessStatus
    })
    
  } catch (error) {
    console.error('Template access API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check template access'
    }, { status: 500 })
  }
}