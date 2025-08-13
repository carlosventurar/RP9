/**
 * Analytics KPIs API Function
 * Sirve datos para los dashboards Executive, Operations y Financial
 * GET /api/analytics/kpis?dashboard=executive&period=30d&tenant_id=xxx
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifyApiKey } from '../../lib/security/apiKeys';
import { checkRateLimit } from '../../lib/security/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DashboardType = 'executive' | 'operations' | 'financial';
type Period = '7d' | '30d' | '90d' | '12m';

interface ExecutiveKPIs {
  roi_usd: number;
  roi_trend: number;
  ttv_days_avg: number;
  ttv_trend: number;
  adoption_rate: number;
  adoption_trend: number;
  hours_saved_total: number;
  hours_saved_trend: number;
  cohort_ttv: Array<{
    week: string;
    signups: number;
    ttv_achieved: number;
    ttv_rate: number;
    avg_days: number;
  }>;
  roi_breakdown: Array<{
    month: string;
    roi_usd: number;
    hours_saved: number;
    cost_usd: number;
  }>;
}

interface OperationsKPIs {
  success_rate: number;
  success_trend: number;
  error_rate: number;
  error_trend: number;
  p95_execution_time: number;
  p95_trend: number;
  data_freshness_score: number;
  executions_daily: Array<{
    date: string;
    total: number;
    success: number;
    errors: number;
    p95_time: number;
  }>;
  top_error_templates: Array<{
    template_id: string;
    template_name: string;
    error_count: number;
    error_rate: number;
  }>;
  funnel_conversion: {
    wizard_starts: number;
    template_installs: number;
    first_executions: number;
    first_successes: number;
    conversion_rate: number;
  };
}

interface FinancialKPIs {
  cost_total_usd: number;
  cost_trend: number;
  cost_per_execution: number;
  cost_efficiency_trend: number;
  overage_risk: number;
  top_cost_workflows: Array<{
    workflow_id: string;
    workflow_name: string;
    cost_usd: number;
    execution_count: number;
    avg_cost: number;
  }>;
  cost_breakdown_daily: Array<{
    date: string;
    cost_usd: number;
    execution_count: number;
    avg_cost: number;
  }>;
  savings_vs_cost: {
    hours_saved_value_usd: number;
    platform_cost_usd: number;
    net_savings_usd: number;
    savings_multiple: number;
  };
}

function getPeriodFilter(period: Period): { startDate: string; endDate: string } {
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

async function getExecutiveKPIs(tenantId: string, period: Period): Promise<ExecutiveKPIs> {
  const { startDate, endDate } = getPeriodFilter(period);

  // Obtener KPIs principales usando vista materializada
  const { data: nsmData } = await supabase
    .from('mv_nsm_usd')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('month', startDate.slice(0, 7))
    .order('month', { ascending: false })
    .limit(1);

  // Obtener datos de cohort TTV
  const { data: cohortData } = await supabase
    .from('mv_ttv_cohorts_weekly')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('signup_week', startDate)
    .order('signup_week', { ascending: true });

  // Calcular tendencias comparando con período anterior
  const { data: trendData } = await supabase
    .rpc('calculate_executive_trends', {
      p_tenant_id: tenantId,
      p_current_start: startDate,
      p_current_end: endDate
    });

  const currentKPIs = nsmData?.[0] || {
    roi_usd: 0,
    ttv_days_avg: null,
    adoption_rate: 0,
    hours_saved_total: 0
  };

  const trends = trendData?.[0] || {
    roi_trend: 0,
    ttv_trend: 0,
    adoption_trend: 0,
    hours_saved_trend: 0
  };

  return {
    roi_usd: currentKPIs.roi_usd,
    roi_trend: trends.roi_trend,
    ttv_days_avg: currentKPIs.ttv_days_avg || 0,
    ttv_trend: trends.ttv_trend,
    adoption_rate: currentKPIs.adoption_rate,
    adoption_trend: trends.adoption_trend,
    hours_saved_total: currentKPIs.hours_saved_total,
    hours_saved_trend: trends.hours_saved_trend,
    cohort_ttv: (cohortData || []).map(c => ({
      week: c.signup_week,
      signups: c.signups,
      ttv_achieved: c.ttv_achieved,
      ttv_rate: c.ttv_rate,
      avg_days: c.avg_ttv_days
    })),
    roi_breakdown: (nsmData || []).map(r => ({
      month: r.month,
      roi_usd: r.roi_usd,
      hours_saved: r.hours_saved_total,
      cost_usd: r.cost_usd_total
    }))
  };
}

async function getOperationsKPIs(tenantId: string, period: Period): Promise<OperationsKPIs> {
  const { startDate, endDate } = getPeriodFilter(period);

  // Métricas de operaciones desde rollups diarios
  const { data: opsData } = await supabase
    .from('kpi_rollups_daily')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  // Top templates con errores
  const { data: errorTemplates } = await supabase
    .rpc('get_top_error_templates', {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate
    });

  // Funnel conversion desde vista materializada
  const { data: funnelData } = await supabase
    .from('mv_funnels_daily')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Calcular agregados
  const totalExecs = opsData?.reduce((sum, d) => sum + (d.executions_total || 0), 0) || 0;
  const totalSuccess = opsData?.reduce((sum, d) => sum + (d.executions_success || 0), 0) || 0;
  const totalErrors = opsData?.reduce((sum, d) => sum + (d.executions_errors || 0), 0) || 0;
  
  const successRate = totalExecs > 0 ? (totalSuccess / totalExecs) * 100 : 0;
  const errorRate = totalExecs > 0 ? (totalErrors / totalExecs) * 100 : 0;
  
  // P95 promedio ponderado
  const avgP95 = opsData?.length > 0 
    ? opsData.reduce((sum, d) => sum + (d.execution_time_p95 || 0), 0) / opsData.length
    : 0;

  // Funnel totals
  const funnelTotals = funnelData?.reduce((acc, f) => ({
    wizard_starts: acc.wizard_starts + (f.wizard_starts || 0),
    template_installs: acc.template_installs + (f.template_installs || 0),
    first_executions: acc.first_executions + (f.first_executions || 0),
    first_successes: acc.first_successes + (f.first_successes || 0)
  }), { wizard_starts: 0, template_installs: 0, first_executions: 0, first_successes: 0 }) || 
  { wizard_starts: 0, template_installs: 0, first_executions: 0, first_successes: 0 };

  const conversionRate = funnelTotals.wizard_starts > 0 
    ? (funnelTotals.first_successes / funnelTotals.wizard_starts) * 100 
    : 0;

  return {
    success_rate: successRate,
    success_trend: 0, // TODO: calcular trend
    error_rate: errorRate,
    error_trend: 0, // TODO: calcular trend
    p95_execution_time: avgP95,
    p95_trend: 0, // TODO: calcular trend
    data_freshness_score: 95, // TODO: calcular basado en lag
    executions_daily: (opsData || []).map(d => ({
      date: d.date,
      total: d.executions_total || 0,
      success: d.executions_success || 0,
      errors: d.executions_errors || 0,
      p95_time: d.execution_time_p95 || 0
    })),
    top_error_templates: (errorTemplates || []).map(t => ({
      template_id: t.template_id,
      template_name: t.template_name,
      error_count: t.error_count,
      error_rate: t.error_rate
    })),
    funnel_conversion: {
      ...funnelTotals,
      conversion_rate: conversionRate
    }
  };
}

async function getFinancialKPIs(tenantId: string, period: Period): Promise<FinancialKPIs> {
  const { startDate, endDate } = getPeriodFilter(period);

  // Costos desde rollups diarios
  const { data: costData } = await supabase
    .from('kpi_rollups_daily')
    .select('date, cost_usd_total, executions_total')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  // Top workflows por costo
  const { data: topCosts } = await supabase
    .rpc('get_top_cost_workflows', {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate
    });

  // Ahorros vs costos
  const { data: savingsData } = await supabase
    .rpc('calculate_savings_vs_cost', {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate
    });

  const totalCost = costData?.reduce((sum, d) => sum + (d.cost_usd_total || 0), 0) || 0;
  const totalExecs = costData?.reduce((sum, d) => sum + (d.executions_total || 0), 0) || 0;
  const costPerExecution = totalExecs > 0 ? totalCost / totalExecs : 0;

  const savings = savingsData?.[0] || {
    hours_saved_value_usd: 0,
    platform_cost_usd: totalCost,
    net_savings_usd: 0,
    savings_multiple: 0
  };

  return {
    cost_total_usd: totalCost,
    cost_trend: 0, // TODO: calcular trend
    cost_per_execution: costPerExecution,
    cost_efficiency_trend: 0, // TODO: calcular trend
    overage_risk: 0, // TODO: calcular basado en límites
    top_cost_workflows: (topCosts || []).map(w => ({
      workflow_id: w.workflow_id,
      workflow_name: w.workflow_name,
      cost_usd: w.cost_usd,
      execution_count: w.execution_count,
      avg_cost: w.avg_cost
    })),
    cost_breakdown_daily: (costData || []).map(d => ({
      date: d.date,
      cost_usd: d.cost_usd_total || 0,
      execution_count: d.executions_total || 0,
      avg_cost: d.executions_total > 0 ? (d.cost_usd_total || 0) / d.executions_total : 0
    })),
    savings_vs_cost: savings
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const params = new URLSearchParams(event.queryStringParameters || '');
    const dashboard = params.get('dashboard') as DashboardType;
    const period = (params.get('period') as Period) || '30d';
    const tenantId = params.get('tenant_id');

    if (!dashboard || !tenantId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'dashboard and tenant_id are required' }) 
      };
    }

    if (!['executive', 'operations', 'financial'].includes(dashboard)) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Invalid dashboard type' }) 
      };
    }

    // Rate limiting
    const allowed = await checkRateLimit(`analytics-kpis:${tenantId}`, 100); // 100/min
    if (!allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
    }

    // Verificar acceso al tenant (RLS se encarga en queries)
    let kpis: any;

    switch (dashboard) {
      case 'executive':
        kpis = await getExecutiveKPIs(tenantId, period);
        break;
      case 'operations':
        kpis = await getOperationsKPIs(tenantId, period);
        break;
      case 'financial':
        kpis = await getFinancialKPIs(tenantId, period);
        break;
      default:
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid dashboard' }) };
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutos de cache
      },
      body: JSON.stringify({
        dashboard,
        period,
        tenant_id: tenantId,
        data: kpis,
        generated_at: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Analytics KPIs error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Internal server error' }) 
    };
  }
};