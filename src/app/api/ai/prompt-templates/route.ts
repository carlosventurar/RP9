import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  category: z.string().min(1),
  prompt: z.string().min(1),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    defaultValue: z.string().optional(),
    required: z.boolean()
  })),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  tenantId: z.string().uuid()
})

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const category = searchParams.get('category')
    const isPublic = searchParams.get('public')

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId parameter required' },
        { status: 400 }
      )
    }

    // Check tenant access
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Access denied to tenant' },
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from('ai_prompt_templates')
      .select(`
        id,
        name,
        description,
        category,
        prompt,
        variables,
        tags,
        is_public,
        tenant_id,
        created_at,
        updated_at,
        usage_count,
        rating
      `)
      .order('created_at', { ascending: false })

    // Filter by tenant (own templates) or public templates
    if (isPublic === 'true') {
      query = query.eq('is_public', true)
    } else {
      query = query.or(`tenant_id.eq.${tenantId},is_public.eq.true`)
    }

    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data: templates, error } = await query

    if (error) {
      throw error
    }

    // Transform data for frontend
    const transformedTemplates = templates?.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      prompt: template.prompt,
      variables: template.variables || [],
      tags: template.tags || [],
      isPublic: template.is_public,
      tenantId: template.tenant_id,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      usageCount: template.usage_count || 0,
      rating: template.rating
    })) || []

    return NextResponse.json({
      success: true,
      templates: transformedTemplates
    })

  } catch (error: any) {
    console.error('Get Prompt Templates API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createTemplateSchema.parse(body)

    // Check tenant access
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', validatedData.tenantId)
      .or(`owner_user_id.eq.${user.id},id.in.(select tenant_id from tenant_members where user_id = '${user.id}')`)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Access denied to tenant' },
        { status: 403 }
      )
    }

    // Create template in database
    const { data: template, error } = await supabase
      .from('ai_prompt_templates')
      .insert({
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        prompt: validatedData.prompt,
        variables: validatedData.variables,
        tags: validatedData.tags,
        is_public: validatedData.isPublic,
        tenant_id: validatedData.tenantId,
        created_by: user.id,
        usage_count: 0
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Transform data for frontend
    const transformedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      prompt: template.prompt,
      variables: template.variables || [],
      tags: template.tags || [],
      isPublic: template.is_public,
      tenantId: template.tenant_id,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      usageCount: template.usage_count || 0,
      rating: template.rating
    }

    return NextResponse.json({
      success: true,
      template: transformedTemplate
    })

  } catch (error: any) {
    console.error('Create Prompt Template API Error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }
    
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}