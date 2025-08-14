import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get auth token from headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const templateId = params.id

    // Check if template exists and user has permission
    const { data: template, error: templateError } = await supabase
      .from('ai_prompt_templates')
      .select('id, tenant_id, created_by')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Check if user has access to the tenant or is the creator
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', template.tenant_id)
      .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
      .single()

    if ((tenantError || !tenant) && template.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Delete the template
    const { error: deleteError } = await supabase
      .from('ai_prompt_templates')
      .delete()
      .eq('id', templateId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete Prompt Template API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get auth token from headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const templateId = params.id
    const body = await request.json()

    // Check if template exists and user has permission
    const { data: template, error: templateError } = await supabase
      .from('ai_prompt_templates')
      .select('id, tenant_id, created_by')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Check if user has access to the tenant or is the creator
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', template.tenant_id)
      .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
      .single()

    if ((tenantError || !tenant) && template.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Update template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('ai_prompt_templates')
      .update({
        name: body.name,
        description: body.description,
        category: body.category,
        prompt: body.prompt,
        variables: body.variables,
        tags: body.tags,
        is_public: body.isPublic,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Transform data for frontend
    const transformedTemplate = {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      category: updatedTemplate.category,
      prompt: updatedTemplate.prompt,
      variables: updatedTemplate.variables || [],
      tags: updatedTemplate.tags || [],
      isPublic: updatedTemplate.is_public,
      tenantId: updatedTemplate.tenant_id,
      createdAt: updatedTemplate.created_at,
      updatedAt: updatedTemplate.updated_at,
      usageCount: updatedTemplate.usage_count || 0,
      rating: updatedTemplate.rating
    }

    return NextResponse.json({
      success: true,
      template: transformedTemplate
    })

  } catch (error: any) {
    console.error('Update Prompt Template API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}