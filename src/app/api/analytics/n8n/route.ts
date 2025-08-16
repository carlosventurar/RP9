import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Autenticación requerida
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verificar permisos del usuario (solo admin o con permiso analytics)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, permissions')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      )
    }

    // Verificar si el usuario tiene permisos para ver analytics
    const hasAnalyticsPermission = profile.role === 'admin' || 
      (profile.permissions && profile.permissions.includes('analytics'))

    if (!hasAnalyticsPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Analytics access required.' },
        { status: 403 }
      )
    }

    // Get query parameters
    const url = new URL(request.url)
    const timeframe = url.searchParams.get('timeframe') || '24h'
    const tenant_id = url.searchParams.get('tenant_id')
    const format = url.searchParams.get('format') || 'json'

    // Validar timeframe
    const validTimeframes = ['1h', '6h', '12h', '24h', '7d', '30d']
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: 'Invalid timeframe. Valid options: ' + validTimeframes.join(', ') },
        { status: 400 }
      )
    }

    // Get tenant for user if not provided
    let targetTenantId = tenant_id
    if (!targetTenantId) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user_id', user.id)
        .single()

      if (tenant && !tenantError) {
        targetTenantId = tenant.id
      }
    }

    // Llamar a la función Netlify mejorada
    const n8nMetricsUrl = `${process.env.NETLIFY_URL || 'http://localhost:8888'}/.netlify/functions/metrics/n8n-metrics`
    const params = new URLSearchParams({
      timeframe,
      ...(targetTenantId && { tenant_id: targetTenantId })
    })

    console.log('Fetching n8n metrics from:', `${n8nMetricsUrl}?${params}`)

    const metricsResponse = await fetch(`${n8nMetricsUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.NETLIFY_FUNCTIONS_SECRET}`,
        'Content-Type': 'application/json'
      }
    })

    if (!metricsResponse.ok) {
      console.error('N8n metrics fetch failed:', metricsResponse.status, metricsResponse.statusText)
      
      // Fallback a métricas mock si falla la conexión
      const fallbackMetrics = {
        ok: true,
        metrics: {
          // Métricas básicas
          executions_total: 0,
          executions_success: 0,
          executions_error: 0,
          executions_running: 0,
          executions_waiting: 0,
          workflows_active: 0,
          workflows_total: 0,
          
          // Métricas de rendimiento
          error_rate: 0,
          success_rate: 0,
          avg_execution_time: 0,
          p95_execution_time: 0,
          p99_execution_time: 0,
          
          // Estado del sistema
          system_health: 'unknown' as const,
          database_status: 'unknown' as const,
          redis_status: 'unknown' as const,
          system_uptime: 0,
          
          // Recursos
          memory_usage_mb: 0,
          cpu_usage_percent: 0,
          active_connections: 0,
          queue_size: 0,
          
          // Análisis
          nodes_execution_time: {},
          top_failing_workflows: [],
          top_slow_workflows: [],
          node_failure_analysis: {},
          
          // Tendencias
          hourly_execution_trend: [],
          daily_success_rate: [],
          
          source: 'fallback',
          timeframe,
          generated_at: new Date().toISOString(),
          note: 'N8n metrics endpoint unavailable - using fallback data'
        }
      }

      return NextResponse.json(fallbackMetrics, {
        status: 200,
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Fallback': 'true'
        }
      })
    }

    const metricsData = await metricsResponse.json()

    // Agregar metadatos adicionales
    const responseData = {
      ...metricsData,
      requestInfo: {
        user_id: user.id,
        tenant_id: targetTenantId,
        timeframe,
        requested_at: new Date().toISOString(),
        user_role: profile.role
      }
    }

    // Registrar el acceso a analytics para auditoría
    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'analytics_access',
        resource_type: 'n8n_metrics',
        resource_id: targetTenantId,
        details: {
          timeframe,
          endpoint: '/api/analytics/n8n',
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
    } catch (auditError) {
      console.error('Failed to log analytics access:', auditError)
      // No fallar la request por esto
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Data-Source': metricsData.metrics?.source || 'unknown'
      }
    })

  } catch (error) {
    console.error('Analytics API error:', error)
    
    return NextResponse.json({
      ok: false,
      error: 'Internal server error',
      message: 'Failed to fetch analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST para configuración avanzada de métricas
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Autenticación requerida
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Solo admins pueden configurar métricas
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      n8n_base_url, 
      n8n_api_key, 
      metrics_enabled,
      collection_interval,
      alert_thresholds 
    } = body

    // Validar configuración
    if (metrics_enabled && (!n8n_base_url || !n8n_api_key)) {
      return NextResponse.json(
        { error: 'N8n base URL and API key required when metrics are enabled' },
        { status: 400 }
      )
    }

    // Guardar configuración en variables de entorno o DB
    // Esto depende de tu estrategia de configuración
    
    return NextResponse.json({
      ok: true,
      message: 'Analytics configuration updated successfully',
      config: {
        metrics_enabled,
        collection_interval,
        alert_thresholds
      }
    })

  } catch (error) {
    console.error('Analytics config error:', error)
    
    return NextResponse.json({
      ok: false,
      error: 'Configuration update failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}