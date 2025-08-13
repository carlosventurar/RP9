/**
 * Analytics Aggregate Function - Scheduled
 * Actualiza rollups diarios/mensuales y refresca vistas materializadas
 * Ejecuta diariamente a las 02:00 UTC
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DailyMetrics {
  tenant_id: string;
  date: string;
  executions_total: number;
  executions_success: number;
  executions_errors: number;
  cost_usd_total: number;
  execution_time_p95: number;
  hours_saved_total: number;
  outcomes_first_victory: number;
  outcomes_continuous: number;
  funnel_wizard_starts: number;
  funnel_template_installs: number;
  funnel_first_executions: number;
  funnel_first_successes: number;
}

interface MonthlyMetrics {
  tenant_id: string;
  month: string;
  roi_usd: number;
  ttv_days_avg: number;
  adoption_rate: number;
  retention_rate: number;
  churn_rate: number;
  hours_saved_total: number;
  cost_usd_total: number;
}

async function calculateDailyMetrics(date: string): Promise<void> {
  console.log(`Calculating daily metrics for ${date}`);

  // Obtener lista de tenants activos
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('status', 'active');

  if (!tenants) return;

  for (const tenant of tenants) {
    try {
      // Calcular métricas de ejecuciones
      const { data: execMetrics } = await supabase
        .rpc('calculate_daily_execution_metrics', {
          p_tenant_id: tenant.id,
          p_date: date
        });

      // Calcular métricas de funnel
      const { data: funnelMetrics } = await supabase
        .rpc('calculate_daily_funnel_metrics', {
          p_tenant_id: tenant.id,
          p_date: date
        });

      // Calcular métricas de outcomes
      const { data: outcomeMetrics } = await supabase
        .rpc('calculate_daily_outcome_metrics', {
          p_tenant_id: tenant.id,
          p_date: date
        });

      // Combinar métricas
      const dailyRollup: Partial<DailyMetrics> = {
        tenant_id: tenant.id,
        date,
        executions_total: execMetrics?.[0]?.total || 0,
        executions_success: execMetrics?.[0]?.success || 0,
        executions_errors: execMetrics?.[0]?.errors || 0,
        cost_usd_total: execMetrics?.[0]?.cost_total || 0,
        execution_time_p95: execMetrics?.[0]?.time_p95 || 0,
        hours_saved_total: outcomeMetrics?.[0]?.hours_saved || 0,
        outcomes_first_victory: outcomeMetrics?.[0]?.first_victory || 0,
        outcomes_continuous: outcomeMetrics?.[0]?.continuous || 0,
        funnel_wizard_starts: funnelMetrics?.[0]?.wizard_starts || 0,
        funnel_template_installs: funnelMetrics?.[0]?.template_installs || 0,
        funnel_first_executions: funnelMetrics?.[0]?.first_executions || 0,
        funnel_first_successes: funnelMetrics?.[0]?.first_successes || 0
      };

      // Insertar/actualizar rollup diario
      await supabase
        .from('kpi_rollups_daily')
        .upsert({
          ...dailyRollup,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,date'
        });

    } catch (error) {
      console.error(`Error calculating daily metrics for tenant ${tenant.id}:`, error);
    }
  }
}

async function calculateMonthlyMetrics(month: string): Promise<void> {
  console.log(`Calculating monthly metrics for ${month}`);

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('status', 'active');

  if (!tenants) return;

  for (const tenant of tenants) {
    try {
      // Calcular ROI basado en horas ahorradas
      const { data: roiData } = await supabase
        .rpc('calculate_monthly_roi', {
          p_tenant_id: tenant.id,
          p_month: month
        });

      // Calcular TTV promedio
      const { data: ttvData } = await supabase
        .rpc('calculate_monthly_ttv', {
          p_tenant_id: tenant.id,
          p_month: month
        });

      // Calcular tasas de adopción y retención
      const { data: adoptionData } = await supabase
        .rpc('calculate_monthly_adoption', {
          p_tenant_id: tenant.id,
          p_month: month
        });

      // Sumar costos y horas ahorradas del mes
      const { data: totalsData } = await supabase
        .rpc('calculate_monthly_totals', {
          p_tenant_id: tenant.id,
          p_month: month
        });

      const monthlyRollup: Partial<MonthlyMetrics> = {
        tenant_id: tenant.id,
        month,
        roi_usd: roiData?.[0]?.roi || 0,
        ttv_days_avg: ttvData?.[0]?.avg_days || null,
        adoption_rate: adoptionData?.[0]?.adoption_rate || 0,
        retention_rate: adoptionData?.[0]?.retention_rate || 0,
        churn_rate: adoptionData?.[0]?.churn_rate || 0,
        hours_saved_total: totalsData?.[0]?.hours_saved || 0,
        cost_usd_total: totalsData?.[0]?.cost_total || 0
      };

      // Insertar/actualizar rollup mensual
      await supabase
        .from('kpi_rollups_monthly')
        .upsert({
          ...monthlyRollup,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,month'
        });

    } catch (error) {
      console.error(`Error calculating monthly metrics for tenant ${tenant.id}:`, error);
    }
  }
}

async function refreshMaterializedViews(): Promise<void> {
  console.log('Refreshing materialized views...');

  try {
    // Llamar función helper que refresca todas las vistas materializadas
    await supabase.rpc('refresh_analytics_materialized_views');
    console.log('Materialized views refreshed successfully');
  } catch (error) {
    console.error('Error refreshing materialized views:', error);
    throw error;
  }
}

async function cleanupOldData(): Promise<void> {
  console.log('Cleaning up old analytics data...');

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];

  try {
    // Limpiar eventos de funnel antiguos (retener 6 meses)
    await supabase
      .from('funnel_events')
      .delete()
      .lt('created_at', cutoffDate);

    // Limpiar ejecuciones antiguas (retener 6 meses)
    await supabase
      .from('usage_executions')
      .delete()
      .lt('started_at', cutoffDate);

    console.log(`Cleaned up data older than ${cutoffDate}`);
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
}

export const handler: Handler = async (event) => {
  // Solo permitir ejecución programada o POST con auth
  if (event.httpMethod === 'POST') {
    const authHeader = event.headers.authorization;
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }

  try {
    console.log('Starting analytics aggregation...');

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString().slice(0, 7);

    // 1. Calcular métricas diarias para ayer
    await calculateDailyMetrics(yesterdayStr);

    // 2. Si es día 1 del mes, calcular métricas del mes anterior
    if (now.getDate() === 1) {
      await calculateMonthlyMetrics(lastMonth);
    }

    // 3. Refrescar vistas materializadas
    await refreshMaterializedViews();

    // 4. Cleanup de datos antiguos (solo domingo a las 02:00)
    if (now.getDay() === 0) {
      await cleanupOldData();
    }

    // 5. Actualizar timestamp de última agregación
    await supabase
      .from('kpi_rollups_daily')
      .upsert({
        tenant_id: 'system',
        date: yesterdayStr,
        aggregation_completed_at: now.toISOString(),
        updated_at: now.toISOString()
      }, {
        onConflict: 'tenant_id,date'
      });

    console.log('Analytics aggregation completed successfully');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        processed_date: yesterdayStr,
        materialized_views_refreshed: true,
        timestamp: now.toISOString()
      })
    };

  } catch (error) {
    console.error('Analytics aggregation error:', error);

    // Log error para monitoring
    await supabase
      .from('kpi_rollups_daily')
      .upsert({
        tenant_id: 'system',
        date: new Date().toISOString().split('T')[0],
        aggregation_errors: 1,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,date'
      });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Aggregation failed' })
    };
  }
};