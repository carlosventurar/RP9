/**
 * Analytics Lag Monitor Function - Scheduled
 * Detecta lag en los datos y envía alertas cuando hay problemas
 * Ejecuta cada hora: 0 * * * *
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DataLagMetrics {
  data_source: string;
  expected_lag_minutes: number;
  actual_lag_minutes: number;
  is_lagging: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  last_data_point: string;
  tenant_id?: string;
}

interface AlertPayload {
  alert_type: 'data_lag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: DataLagMetrics[];
  tenant_id?: string;
}

async function checkExecutionDataLag(): Promise<DataLagMetrics[]> {
  const results: DataLagMetrics[] = [];

  // Verificar lag global de ejecuciones n8n
  const { data: lastExecution } = await supabase
    .from('usage_executions')
    .select('collected_at')
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();

  if (lastExecution) {
    const lastCollected = new Date(lastExecution.collected_at);
    const now = new Date();
    const lagMinutes = (now.getTime() - lastCollected.getTime()) / (1000 * 60);
    
    // Esperamos datos cada 15 minutos máximo
    const expectedLag = 15;
    const isLagging = lagMinutes > expectedLag;
    
    let severity: DataLagMetrics['severity'] = 'low';
    if (lagMinutes > 60) severity = 'critical';
    else if (lagMinutes > 30) severity = 'high';
    else if (lagMinutes > 15) severity = 'medium';

    results.push({
      data_source: 'n8n_executions',
      expected_lag_minutes: expectedLag,
      actual_lag_minutes: Math.round(lagMinutes),
      is_lagging: isLagging,
      severity,
      last_data_point: lastExecution.collected_at
    });
  }

  // Verificar lag por tenant (tenants con > 10 ejecuciones/día)
  const { data: activeTenants } = await supabase
    .rpc('get_active_tenants_for_lag_monitoring');

  if (activeTenants) {
    for (const tenant of activeTenants) {
      const { data: lastTenantExecution } = await supabase
        .from('usage_executions')
        .select('collected_at')
        .eq('tenant_id', tenant.tenant_id)
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();

      if (lastTenantExecution) {
        const lastCollected = new Date(lastTenantExecution.collected_at);
        const now = new Date();
        const lagMinutes = (now.getTime() - lastCollected.getTime()) / (1000 * 60);
        
        // Para tenants activos, esperamos datos cada 60 minutos máximo
        const expectedLag = 60;
        const isLagging = lagMinutes > expectedLag;
        
        let severity: DataLagMetrics['severity'] = 'low';
        if (lagMinutes > 240) severity = 'high'; // 4 horas
        else if (lagMinutes > 120) severity = 'medium'; // 2 horas

        if (isLagging) {
          results.push({
            data_source: `tenant_executions_${tenant.tenant_id}`,
            expected_lag_minutes: expectedLag,
            actual_lag_minutes: Math.round(lagMinutes),
            is_lagging: isLagging,
            severity,
            last_data_point: lastTenantExecution.collected_at,
            tenant_id: tenant.tenant_id
          });
        }
      }
    }
  }

  return results;
}

async function checkAggregationLag(): Promise<DataLagMetrics[]> {
  const results: DataLagMetrics[] = [];

  // Verificar lag en rollups diarios
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: rollupCheck } = await supabase
    .from('kpi_rollups_daily')
    .select('date, updated_at')
    .eq('date', yesterdayStr)
    .eq('tenant_id', 'system') // Sistema de control
    .single();

  if (!rollupCheck) {
    // No hay rollup para ayer - problema crítico
    results.push({
      data_source: 'daily_rollups',
      expected_lag_minutes: 60, // Esperamos que se ejecute a las 02:00
      actual_lag_minutes: 999, // Marca como muy tarde
      is_lagging: true,
      severity: 'critical',
      last_data_point: 'missing'
    });
  } else {
    const rollupTime = new Date(rollupCheck.updated_at);
    const expectedTime = new Date(yesterday);
    expectedTime.setUTCHours(2, 30, 0, 0); // 02:30 UTC (30 min después del job)
    
    const lagMinutes = (rollupTime.getTime() - expectedTime.getTime()) / (1000 * 60);
    const isLagging = lagMinutes > 60; // Más de 1 hora tarde

    if (isLagging) {
      let severity: DataLagMetrics['severity'] = 'medium';
      if (lagMinutes > 240) severity = 'critical'; // 4+ horas tarde
      else if (lagMinutes > 120) severity = 'high'; // 2+ horas tarde

      results.push({
        data_source: 'daily_rollups',
        expected_lag_minutes: 30,
        actual_lag_minutes: Math.round(lagMinutes),
        is_lagging: isLagging,
        severity,
        last_data_point: rollupCheck.updated_at
      });
    }
  }

  return results;
}

async function checkMaterializedViewFreshness(): Promise<DataLagMetrics[]> {
  const results: DataLagMetrics[] = [];

  // Verificar frescura de vistas materializadas
  const { data: mvStats } = await supabase
    .rpc('get_materialized_view_stats');

  if (mvStats) {
    for (const mv of mvStats) {
      const lastRefresh = new Date(mv.last_refresh);
      const now = new Date();
      const lagMinutes = (now.getTime() - lastRefresh.getTime()) / (1000 * 60);
      
      // Esperamos refresh cada 24 horas para MVs
      const expectedLag = 24 * 60; // 24 horas
      const isLagging = lagMinutes > expectedLag;

      if (isLagging) {
        let severity: DataLagMetrics['severity'] = 'low';
        if (lagMinutes > 72 * 60) severity = 'high'; // 3+ días
        else if (lagMinutes > 48 * 60) severity = 'medium'; // 2+ días

        results.push({
          data_source: `mv_${mv.view_name}`,
          expected_lag_minutes: expectedLag,
          actual_lag_minutes: Math.round(lagMinutes),
          is_lagging: isLagging,
          severity,
          last_data_point: mv.last_refresh
        });
      }
    }
  }

  return results;
}

async function sendSlackAlert(alert: AlertPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_ALERTS_WEBHOOK;
  if (!webhookUrl) {
    console.warn('Slack webhook not configured, skipping alert');
    return;
  }

  const severityEmojis = {
    low: '🟡',
    medium: '🟠', 
    high: '🔴',
    critical: '🚨'
  };

  const message = {
    text: `${severityEmojis[alert.severity]} RP9 Analytics Data Lag Alert`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmojis[alert.severity]} Data Lag Alert - ${alert.severity.toUpperCase()}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alert.message
        }
      },
      {
        type: 'section',
        fields: alert.details.map(detail => ({
          type: 'mrkdwn',
          text: `*${detail.data_source}*\nLag: ${detail.actual_lag_minutes}min (expected: ${detail.expected_lag_minutes}min)\nLast: ${detail.last_data_point}`
        }))
      }
    ]
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  } catch (error) {
    console.error('Error sending Slack alert:', error);
  }
}

async function logAlert(metrics: DataLagMetrics[]): Promise<void> {
  // Log a tabla de audit_logs para tracking
  for (const metric of metrics) {
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: metric.tenant_id || 'system',
        action: 'data_lag_detected',
        resource_type: 'analytics',
        resource_id: metric.data_source,
        metadata: {
          expected_lag_minutes: metric.expected_lag_minutes,
          actual_lag_minutes: metric.actual_lag_minutes,
          severity: metric.severity,
          last_data_point: metric.last_data_point
        },
        created_at: new Date().toISOString()
      });
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
    console.log('Starting data lag monitoring...');

    // Verificar diferentes fuentes de lag
    const [
      executionLags,
      aggregationLags, 
      mvLags
    ] = await Promise.all([
      checkExecutionDataLag(),
      checkAggregationLag(),
      checkMaterializedViewFreshness()
    ]);

    const allLags = [...executionLags, ...aggregationLags, ...mvLags];
    const laggingData = allLags.filter(lag => lag.is_lagging);

    console.log(`Found ${laggingData.length} lagging data sources`);

    if (laggingData.length > 0) {
      // Agrupar por severidad
      const critical = laggingData.filter(l => l.severity === 'critical');
      const high = laggingData.filter(l => l.severity === 'high');
      const medium = laggingData.filter(l => l.severity === 'medium');
      const low = laggingData.filter(l => l.severity === 'low');

      // Enviar alertas por severidad (solo critical y high)
      if (critical.length > 0) {
        await sendSlackAlert({
          alert_type: 'data_lag',
          severity: 'critical',
          message: `🚨 CRÍTICO: ${critical.length} fuentes de datos con lag crítico en RP9 Analytics`,
          details: critical
        });
      }

      if (high.length > 0) {
        await sendSlackAlert({
          alert_type: 'data_lag',
          severity: 'high',
          message: `🔴 ALTO: ${high.length} fuentes de datos con lag alto en RP9 Analytics`,
          details: high
        });
      }

      // Log todas las alertas para auditoría
      await logAlert(laggingData);

      // Actualizar health score global
      const healthScore = Math.max(0, 100 - (laggingData.length * 10));
      await supabase
        .from('kpi_rollups_daily')
        .upsert({
          tenant_id: 'system',
          date: new Date().toISOString().split('T')[0],
          data_health_score: healthScore,
          data_lag_count: laggingData.length,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,date'
        });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        lag_sources_checked: allLags.length,
        lagging_sources: laggingData.length,
        alerts_sent: laggingData.filter(l => ['critical', 'high'].includes(l.severity)).length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Lag monitor error:', error);

    // Enviar alerta de que el monitor falló
    if (process.env.SLACK_ALERTS_WEBHOOK) {
      await sendSlackAlert({
        alert_type: 'data_lag',
        severity: 'critical',
        message: '🚨 CRÍTICO: Fallo en el monitor de lag de datos de RP9 Analytics',
        details: [{
          data_source: 'lag_monitor_system',
          expected_lag_minutes: 0,
          actual_lag_minutes: 999,
          is_lagging: true,
          severity: 'critical',
          last_data_point: new Date().toISOString()
        }]
      });
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Lag monitoring failed' })
    };
  }
};