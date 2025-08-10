import { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    // For GET requests, we don't require authentication (public templates)
    // For POST/PUT/DELETE, we require authentication
    if (['POST', 'PUT', 'DELETE'].includes(event.httpMethod!)) {
      const authHeader = event.headers.authorization || event.headers.Authorization
      if (!authHeader) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Authorization required for this operation' })
        }
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid token' })
        }
      }
    }

    switch (event.httpMethod) {
      case 'GET':
        return await handleGetTemplates(event)
      case 'POST':
        return await handleCreateTemplate(event)
      case 'PUT':
        return await handleUpdateTemplate(event)
      case 'DELETE':
        return await handleDeleteTemplate(event)
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }

  } catch (error) {
    console.error('Templates API error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function handleGetTemplates(event: HandlerEvent) {
  try {
    const query = event.queryStringParameters || {}
    const {
      category,
      subcategory,
      difficulty,
      price_min,
      price_max,
      search,
      featured,
      limit = '50',
      offset = '0'
    } = query

    let queryBuilder = supabase
      .from('templates')
      .select(`
        id,
        name,
        description,
        category,
        subcategory,
        icon_url,
        preview_images,
        tags,
        difficulty,
        estimated_time,
        price,
        install_count,
        rating,
        is_featured,
        is_active,
        created_at,
        updated_at
      `)
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('install_count', { ascending: false })

    // Apply filters
    if (category && category !== 'all') {
      queryBuilder = queryBuilder.eq('category', category)
    }

    if (subcategory && subcategory !== 'all') {
      queryBuilder = queryBuilder.eq('subcategory', subcategory)
    }

    if (difficulty && difficulty !== 'all') {
      queryBuilder = queryBuilder.eq('difficulty', difficulty)
    }

    if (price_min) {
      queryBuilder = queryBuilder.gte('price', parseFloat(price_min))
    }

    if (price_max) {
      queryBuilder = queryBuilder.lte('price', parseFloat(price_max))
    }

    if (featured === 'true') {
      queryBuilder = queryBuilder.eq('is_featured', true)
    }

    if (search) {
      // Search in name, description, and tags
      queryBuilder = queryBuilder.or(`
        name.ilike.%${search}%,
        description.ilike.%${search}%,
        tags.cs.{${search}}
      `)
    }

    // Apply pagination
    const limitNum = Math.min(parseInt(limit), 100) // Max 100 per request
    const offsetNum = parseInt(offset)
    queryBuilder = queryBuilder.range(offsetNum, offsetNum + limitNum - 1)

    const { data: templates, error, count } = await queryBuilder

    if (error) {
      throw error
    }

    // Get categories for filtering
    const { data: categories } = await supabase
      .from('templates')
      .select('category')
      .eq('is_active', true)
      .distinct()

    const uniqueCategories = [...new Set((categories || []).map(c => c.category))]

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: templates || [],
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: count || templates?.length || 0
        },
        filters: {
          categories: uniqueCategories,
          difficulties: ['beginner', 'intermediate', 'advanced']
        }
      })
    }

  } catch (error) {
    console.error('Error fetching templates:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to fetch templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function handleCreateTemplate(event: HandlerEvent) {
  try {
    const templateData = JSON.parse(event.body || '{}')

    // Validate required fields
    const requiredFields = ['name', 'description', 'category', 'workflow_json']
    const missingFields = requiredFields.filter(field => !templateData[field])

    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Missing required fields',
          missing_fields: missingFields
        })
      }
    }

    // Set defaults
    const template = {
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      subcategory: templateData.subcategory || null,
      workflow_json: templateData.workflow_json,
      icon_url: templateData.icon_url || null,
      preview_images: templateData.preview_images || [],
      tags: templateData.tags || [],
      difficulty: templateData.difficulty || 'intermediate',
      estimated_time: templateData.estimated_time || 10,
      price: templateData.price || 0,
      install_count: 0,
      rating: 0,
      is_featured: templateData.is_featured || false,
      is_active: true,
      author_id: null // Would be set to current user in a real implementation
    }

    const { data: newTemplate, error } = await supabase
      .from('templates')
      .insert([template])
      .select()
      .single()

    if (error) {
      throw error
    }

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: newTemplate
      })
    }

  } catch (error) {
    console.error('Error creating template:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to create template',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function handleUpdateTemplate(event: HandlerEvent) {
  try {
    const pathSegments = event.path.split('/')
    const templateId = pathSegments[pathSegments.length - 1]

    if (!templateId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Template ID required' })
      }
    }

    const updateData = JSON.parse(event.body || '{}')

    // Remove fields that shouldn't be updated via API
    delete updateData.id
    delete updateData.install_count
    delete updateData.rating
    delete updateData.created_at
    delete updateData.updated_at

    const { data: updatedTemplate, error } = await supabase
      .from('templates')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .select()
      .single()

    if (error) {
      throw error
    }

    if (!updatedTemplate) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Template not found' })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: updatedTemplate
      })
    }

  } catch (error) {
    console.error('Error updating template:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to update template',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

async function handleDeleteTemplate(event: HandlerEvent) {
  try {
    const pathSegments = event.path.split('/')
    const templateId = pathSegments[pathSegments.length - 1]

    if (!templateId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Template ID required' })
      }
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('templates')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', templateId)

    if (error) {
      throw error
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Template deleted successfully'
      })
    }

  } catch (error) {
    console.error('Error deleting template:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to delete template',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}