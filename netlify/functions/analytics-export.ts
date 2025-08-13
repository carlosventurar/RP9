/**
 * Analytics Export Function
 * Exporta datos analytics en formato CSV/Excel bajo demanda
 * GET /api/analytics/export?type=kpis&format=csv&period=30d&tenant_id=xxx
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../../lib/security/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ExportType = 'kpis' | 'executions' | 'funnel' | 'outcomes' | 'costs';
type ExportFormat = 'csv' | 'json';

interface ExportOptions {
  type: ExportType;
  format: ExportFormat;
  tenant_id: string;
  period: string;
  start_date?: string;
  end_date?: string;
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Escapar comillas y manejar valores null/undefined
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

function getPeriodFilter(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  
  let startDate: string;
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '12m':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  
  return { startDate, endDate };
}

async function exportKPIs(options: ExportOptions): Promise<any[]> {
  const { startDate, endDate } = options.start_date && options.end_date 
    ? { startDate: options.start_date, endDate: options.end_date }
    : getPeriodFilter(options.period);

  const { data } = await supabase
    .from('kpi_rollups_daily')
    .select(`
      date,
      executions_total,
      executions_success,
      executions_errors,
      cost_usd_total,
      execution_time_p95,
      hours_saved_total,
      outcomes_first_victory,
      outcomes_continuous,
      funnel_wizard_starts,
      funnel_template_installs,
      funnel_first_executions,
      funnel_first_successes
    `)
    .eq('tenant_id', options.tenant_id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  return data?.map(row => ({
    fecha: row.date,
    ejecuciones_total: row.executions_total || 0,
    ejecuciones_exitosas: row.executions_success || 0,
    ejecuciones_error: row.executions_errors || 0,
    tasa_exito_pct: row.executions_total > 0 ? ((row.executions_success || 0) / row.executions_total * 100).toFixed(2) : '0',
    costo_usd: (row.cost_usd_total || 0).toFixed(3),
    tiempo_p95_ms: row.execution_time_p95 || 0,
    horas_ahorradas: row.hours_saved_total || 0,
    outcomes_primera_victoria: row.outcomes_first_victory || 0,
    outcomes_continuos: row.outcomes_continuous || 0,
    funnel_wizard_iniciados: row.funnel_wizard_starts || 0,
    funnel_templates_instalados: row.funnel_template_installs || 0,
    funnel_primeras_ejecuciones: row.funnel_first_executions || 0,
    funnel_primeros_exitos: row.funnel_first_successes || 0,
    tasa_conversion_pct: row.funnel_wizard_starts > 0 ? ((row.funnel_first_successes || 0) / row.funnel_wizard_starts * 100).toFixed(2) : '0'
  })) || [];
}

async function exportExecutions(options: ExportOptions): Promise<any[]> {
  const { startDate, endDate } = options.start_date && options.end_date 
    ? { startDate: options.start_date, endDate: options.end_date }
    : getPeriodFilter(options.period);

  const { data } = await supabase
    .from('usage_executions')
    .select(`
      n8n_execution_id,
      workflow_id,
      template_id,
      status,
      mode,
      started_at,
      finished_at,
      execution_time_ms,
      node_count,
      node_errors,
      cost_usd,
      category
    `)
    .eq('tenant_id', options.tenant_id)
    .gte('started_at', startDate)
    .lte('started_at', endDate)
    .order('started_at', { ascending: false })
    .limit(10000); // Limitar para evitar exports masivos

  return data?.map(row => ({
    execution_id: row.n8n_execution_id,
    workflow_id: row.workflow_id,
    template_id: row.template_id || '',
    estado: row.status,
    modo: row.mode,
    fecha_inicio: row.started_at,
    fecha_fin: row.finished_at || '',
    duracion_ms: row.execution_time_ms || 0,
    duracion_seg: row.execution_time_ms ? (row.execution_time_ms / 1000).toFixed(2) : '0',
    nodos_total: row.node_count || 0,
    nodos_error: row.node_errors || 0,
    costo_usd: (row.cost_usd || 0).toFixed(4),
    categoria: row.category || '',
    exitoso: row.status === 'success' ? 'SI' : 'NO'
  })) || [];
}

async function exportFunnel(options: ExportOptions): Promise<any[]> {
  const { startDate, endDate } = options.start_date && options.end_date 
    ? { startDate: options.start_date, endDate: options.end_date }
    : getPeriodFilter(options.period);

  const { data } = await supabase
    .from('funnel_events')
    .select(`
      user_id,
      step,
      event_name,
      template_id,
      workflow_id,
      metadata,
      created_at
    `)
    .eq('tenant_id', options.tenant_id)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })
    .limit(5000);

  return data?.map(row => ({
    usuario_id: row.user_id || 'anonimo',
    paso_funnel: row.step,
    evento: row.event_name,
    template_id: row.template_id || '',
    workflow_id: row.workflow_id || '',
    fecha_hora: row.created_at,
    metadata_json: JSON.stringify(row.metadata || {})
  })) || [];
}

async function exportOutcomes(options: ExportOptions): Promise<any[]> {
  const { startDate, endDate } = options.start_date && options.end_date 
    ? { startDate: options.start_date, endDate: options.end_date }
    : getPeriodFilter(options.period);

  const { data } = await supabase
    .from('outcomes')
    .select(`
      user_id,
      outcome_type,
      category,
      event_name,
      value_usd,
      hours_saved,
      metadata,
      created_at
    `)
    .eq('tenant_id', options.tenant_id)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })
    .limit(5000);

  return data?.map(row => ({
    usuario_id: row.user_id || 'anonimo',
    tipo_outcome: row.outcome_type,
    categoria: row.category,
    evento: row.event_name,
    valor_usd: (row.value_usd || 0).toFixed(2),
    horas_ahorradas: (row.hours_saved || 0).toFixed(2),
    fecha_hora: row.created_at,
    metadata_json: JSON.stringify(row.metadata || {})
  })) || [];
}

async function exportCosts(options: ExportOptions): Promise<any[]> {
  const { startDate, endDate } = options.start_date && options.end_date 
    ? { startDate: options.start_date, endDate: options.end_date }
    : getPeriodFilter(options.period);

  // Agrupar costos por workflow y día
  const { data } = await supabase
    .rpc('get_costs_breakdown', {
      p_tenant_id: options.tenant_id,
      p_start_date: startDate,
      p_end_date: endDate
    });

  return data?.map((row: any) => ({
    fecha: row.date,
    workflow_id: row.workflow_id,
    workflow_nombre: row.workflow_name || row.workflow_id,
    template_id: row.template_id || '',
    categoria: row.category || '',
    ejecuciones_total: row.execution_count || 0,
    ejecuciones_exitosas: row.success_count || 0,
    ejecuciones_error: row.error_count || 0,
    costo_total_usd: (row.total_cost || 0).toFixed(4),
    costo_promedio_usd: (row.avg_cost || 0).toFixed(4),
    tiempo_total_ms: row.total_time_ms || 0,
    tiempo_promedio_ms: row.avg_time_ms || 0
  })) || [];
}

function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    default:
      return 'txt';
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const params = new URLSearchParams(event.queryStringParameters || '');
    
    const options: ExportOptions = {
      type: (params.get('type') as ExportType) || 'kpis',
      format: (params.get('format') as ExportFormat) || 'csv',
      tenant_id: params.get('tenant_id') || '',
      period: params.get('period') || '30d',
      start_date: params.get('start_date') || undefined,
      end_date: params.get('end_date') || undefined
    };

    if (!options.tenant_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'tenant_id is required' })
      };
    }

    if (!['kpis', 'executions', 'funnel', 'outcomes', 'costs'].includes(options.type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid type. Must be: kpis, executions, funnel, outcomes, costs' })
      };
    }

    if (!['csv', 'json'].includes(options.format)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid format. Must be: csv, json' })
      };
    }

    // Rate limiting más estricto para exports
    const allowed = await checkRateLimit(`analytics-export:${options.tenant_id}`, 5); // 5/min
    if (!allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
    }

    // Obtener datos según el tipo
    let data: any[] = [];
    
    switch (options.type) {
      case 'kpis':
        data = await exportKPIs(options);
        break;
      case 'executions':
        data = await exportExecutions(options);
        break;
      case 'funnel':
        data = await exportFunnel(options);
        break;
      case 'outcomes':
        data = await exportOutcomes(options);
        break;
      case 'costs':
        data = await exportCosts(options);
        break;
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Unsupported export type' })
        };
    }

    if (data.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No data found for the specified parameters' })
      };
    }

    // Formatear según el formato solicitado
    let responseBody: string;
    let contentType: string;

    if (options.format === 'csv') {
      responseBody = convertToCSV(data);
      contentType = 'text/csv';
    } else {
      responseBody = JSON.stringify({
        metadata: {
          export_type: options.type,
          tenant_id: options.tenant_id,
          period: options.period,
          start_date: options.start_date,
          end_date: options.end_date,
          total_records: data.length,
          generated_at: new Date().toISOString()
        },
        data
      }, null, 2);
      contentType = 'application/json';
    }

    const filename = `rp9-analytics-${options.type}-${options.tenant_id}-${new Date().toISOString().split('T')[0]}.${getFileExtension(options.format)}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache'
      },
      body: responseBody
    };

  } catch (error) {
    console.error('Analytics export error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Export failed' })
    };
  }
};