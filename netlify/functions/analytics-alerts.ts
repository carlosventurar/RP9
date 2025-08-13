/**
 * Analytics Alerts Function - Scheduled
 * Detecta anomalías en métricas y envía alertas automáticas a Slack
 * Ejecuta cada 30 minutos: 0,30 * * * *
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AlertRule {
  metric: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  enabled: boolean;
}

interface AlertPayload {
  tenant_id?: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  current_value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

// Configuración de reglas de alerta
const ALERT_RULES: AlertRule[] = [
  // Reglas críticas
  {
    metric: 'success_rate',
    threshold: 95,
    comparison: 'lt',
    severity: 'critical',
    description: 'Tasa de éxito por debajo del SLA crítico',
    enabled: true
  },
  {
    metric: 'roi_usd',
    threshold: 0,
    comparison: 'lt',
    severity: 'critical',
    description: 'ROI negativo - costos superan ahorros',
    enabled: true
  },
  // Reglas altas
  {
    metric: 'error_rate',
    threshold: 10,
    comparison: 'gt',
    severity: 'high',
    description: 'Tasa de error elevada',
    enabled: true
  },
  {
    metric: 'p95_execution_time',
    threshold: 30000, // 30 segundos
    comparison: 'gt',
    severity: 'high',
    description: 'P95 de tiempo de ejecución muy alto',
    enabled: true
  },
  {
    metric: 'ttv_days_avg',
    threshold: 14,
    comparison: 'gt',
    severity: 'high',
    description: 'Time To Value muy lento (>14 días)',
    enabled: true
  },
  // Reglas medias
  {
    metric: 'success_rate',
    threshold: 98,
    comparison: 'lt',
    severity: 'medium',
    description: 'Tasa de éxito por debajo del objetivo',
    enabled: true
  },
  {
    metric: 'adoption_rate',
    threshold: 60,
    comparison: 'lt',
    severity: 'medium',
    description: 'Tasa de adopción baja',
    enabled: true
  },
  {
    metric: 'data_freshness_score',
    threshold: 85,
    comparison: 'lt',
    severity: 'medium',
    description: 'Calidad de datos por debajo del objetivo',
    enabled: true
  }
];

async function getCurrentMetrics(tenantId?: string): Promise<Record<string, number>> {
  try {
    // Si es para un tenant específico, obtener sus métricas
    if (tenantId) {
      const { data: tenantMetrics } = await supabase
        .rpc('get_current_tenant_metrics', { p_tenant_id: tenantId });
      
      return tenantMetrics?.[0] || {};
    }

    // Métricas globales del sistema
    const { data: globalMetrics } = await supabase
      .rpc('get_current_global_metrics');

    return globalMetrics?.[0] || {};
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return {};
  }
}

function checkAlertRule(rule: AlertRule, currentValue: number): boolean {
  switch (rule.comparison) {
    case 'gt':
      return currentValue > rule.threshold;
    case 'lt':
      return currentValue < rule.threshold;
    case 'eq':
      return currentValue === rule.threshold;
    default:
      return false;
  }
}

function formatMetricValue(metric: string, value: number): string {
  if (metric.includes('rate') || metric.includes('adoption')) {
    return `${value.toFixed(1)}%`;
  }
  if (metric.includes('time')) {
    return value < 1000 ? `${value.toFixed(0)}ms` : `${(value / 1000).toFixed(1)}s`;
  }
  if (metric.includes('usd') || metric.includes('roi')) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }
  if (metric.includes('days')) {
    return `${value.toFixed(1)} días`;
  }
  return value.toLocaleString();
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

  const severityColors = {
    low: '#fbbf24',
    medium: '#f97316',
    high: '#ef4444',
    critical: '#dc2626'
  };

  const tenantInfo = alert.tenant_id ? ` (Tenant: ${alert.tenant_id})` : ' (Global)';

  const message = {
    text: `${severityEmojis[alert.severity]} RP9 Analytics Alert - ${alert.severity.toUpperCase()}`,
    attachments: [
      {
        color: severityColors[alert.severity],
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${severityEmojis[alert.severity]} Analytics Alert - ${alert.severity.toUpperCase()}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Métrica:* ${alert.metric}`
              },
              {
                type: 'mrkdwn',
                text: `*Valor Actual:* ${formatMetricValue(alert.metric, alert.current_value)}`
              },
              {
                type: 'mrkdwn',
                text: `*Umbral:* ${formatMetricValue(alert.metric, alert.threshold)}`
              },
              {
                type: 'mrkdwn',
                text: `*Scope:* ${tenantInfo}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Descripción:* ${alert.message}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `⏰ ${alert.timestamp} | 🏷️ ${alert.alert_type}`
              }
            ]
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending Slack alert:', error);
  }
}

async function logAlert(alert: AlertPayload): Promise<void> {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: alert.tenant_id || 'system',
        action: 'analytics_alert_triggered',
        resource_type: 'analytics',
        resource_id: alert.metric,
        metadata: {
          alert_type: alert.alert_type,
          severity: alert.severity,
          current_value: alert.current_value,
          threshold: alert.threshold,
          message: alert.message
        },
        created_at: alert.timestamp
      });
  } catch (error) {
    console.error('Error logging alert:', error);
  }
}

async function checkTenantAlerts(tenantId: string): Promise<AlertPayload[]> {
  const alerts: AlertPayload[] = [];
  const metrics = await getCurrentMetrics(tenantId);

  for (const rule of ALERT_RULES) {
    if (!rule.enabled) continue;

    const currentValue = metrics[rule.metric];
    if (currentValue === undefined) continue;

    if (checkAlertRule(rule, currentValue)) {
      const alert: AlertPayload = {
        tenant_id: tenantId,
        alert_type: 'metric_threshold',
        severity: rule.severity,
        metric: rule.metric,
        current_value: currentValue,
        threshold: rule.threshold,
        message: rule.description,
        timestamp: new Date().toISOString()
      };

      alerts.push(alert);
    }
  }

  return alerts;
}

async function checkGlobalAlerts(): Promise<AlertPayload[]> {
  const alerts: AlertPayload[] = [];
  const metrics = await getCurrentMetrics();

  for (const rule of ALERT_RULES) {
    if (!rule.enabled) continue;

    const currentValue = metrics[rule.metric];
    if (currentValue === undefined) continue;

    if (checkAlertRule(rule, currentValue)) {
      const alert: AlertPayload = {
        alert_type: 'global_metric_threshold',
        severity: rule.severity,
        metric: rule.metric,
        current_value: currentValue,
        threshold: rule.threshold,
        message: `Global: ${rule.description}`,
        timestamp: new Date().toISOString()
      };

      alerts.push(alert);
    }
  }

  return alerts;
}

async function checkAnomalyDetection(): Promise<AlertPayload[]> {
  const alerts: AlertPayload[] = [];

  try {
    // Detectar anomalías en métricas usando desviación estándar
    const { data: anomalies } = await supabase
      .rpc('detect_metric_anomalies', {
        lookback_days: 7,
        std_dev_threshold: 2
      });

    if (anomalies) {
      for (const anomaly of anomalies) {
        const alert: AlertPayload = {
          tenant_id: anomaly.tenant_id,
          alert_type: 'anomaly_detection',
          severity: anomaly.severity || 'medium',
          metric: anomaly.metric,
          current_value: anomaly.current_value,
          threshold: anomaly.expected_value,
          message: `Anomalía detectada: ${anomaly.metric} está ${anomaly.deviation_type} del patrón normal`,
          timestamp: new Date().toISOString()
        };

        alerts.push(alert);
      }
    }
  } catch (error) {
    console.error('Error in anomaly detection:', error);
  }

  return alerts;
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
    console.log('Starting analytics alerts check...');

    const allAlerts: AlertPayload[] = [];

    // 1. Verificar alertas globales
    const globalAlerts = await checkGlobalAlerts();
    allAlerts.push(...globalAlerts);

    // 2. Verificar alertas por tenant (solo tenants activos)
    const { data: activeTenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('status', 'active')
      .limit(50); // Limitar para evitar timeout

    if (activeTenants) {
      for (const tenant of activeTenants) {
        const tenantAlerts = await checkTenantAlerts(tenant.id);
        allAlerts.push(...tenantAlerts);
      }
    }

    // 3. Detección de anomalías
    const anomalyAlerts = await checkAnomalyDetection();
    allAlerts.push(...anomalyAlerts);

    console.log(`Found ${allAlerts.length} alerts to process`);

    // 4. Enviar alertas críticas y altas inmediatamente
    const criticalAlerts = allAlerts.filter(a => ['critical', 'high'].includes(a.severity));
    
    for (const alert of criticalAlerts) {
      await sendSlackAlert(alert);
      await logAlert(alert);
    }

    // 5. Agrupar y enviar alertas medium/low en resumen
    const lowPriorityAlerts = allAlerts.filter(a => ['medium', 'low'].includes(a.severity));
    
    if (lowPriorityAlerts.length > 0) {
      // Enviar resumen cada 2 horas para alertas de prioridad baja
      const now = new Date();
      if (now.getMinutes() === 0 && now.getHours() % 2 === 0) {
        const summaryAlert: AlertPayload = {
          alert_type: 'alerts_summary',
          severity: 'medium',
          metric: 'multiple',
          current_value: lowPriorityAlerts.length,
          threshold: 0,
          message: `Resumen: ${lowPriorityAlerts.length} alertas de prioridad media/baja detectadas`,
          timestamp: now.toISOString()
        };

        await sendSlackAlert(summaryAlert);
      }

      // Log todas las alertas
      for (const alert of lowPriorityAlerts) {
        await logAlert(alert);
      }
    }

    // 6. Actualizar estadísticas de alertas
    await supabase
      .from('kpi_rollups_daily')
      .upsert({
        tenant_id: 'system',
        date: new Date().toISOString().split('T')[0],
        alerts_triggered: allAlerts.length,
        alerts_critical: allAlerts.filter(a => a.severity === 'critical').length,
        alerts_high: allAlerts.filter(a => a.severity === 'high').length,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,date'
      });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        alerts_processed: allAlerts.length,
        critical_alerts: criticalAlerts.length,
        low_priority_alerts: lowPriorityAlerts.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Analytics alerts error:', error);

    // Enviar alerta de que el sistema de alertas falló
    if (process.env.SLACK_ALERTS_WEBHOOK) {
      const errorAlert: AlertPayload = {
        alert_type: 'system_error',
        severity: 'critical',
        metric: 'alerts_system',
        current_value: 0,
        threshold: 1,
        message: '🚨 CRÍTICO: Fallo en el sistema de alertas de RP9 Analytics',
        timestamp: new Date().toISOString()
      };

      await sendSlackAlert(errorAlert);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Alerts processing failed' })
    };
  }
};