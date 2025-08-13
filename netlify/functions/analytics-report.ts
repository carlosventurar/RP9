/**
 * Analytics Report Function
 * Genera reportes PDF mensuales con métricas ejecutivas
 * GET /api/analytics/report?type=monthly&month=2024-01&tenant_id=xxx
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../../lib/security/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MonthlyReport {
  tenant: {
    id: string;
    name: string;
    plan: string;
  };
  period: {
    month: string;
    start_date: string;
    end_date: string;
  };
  executive_summary: {
    roi_usd: number;
    roi_trend: number;
    hours_saved_total: number;
    cost_total_usd: number;
    net_savings_usd: number;
    savings_multiple: number;
    key_achievements: string[];
  };
  kpis: {
    ttv_days_avg: number;
    adoption_rate: number;
    success_rate: number;
    user_growth: number;
  };
  usage_stats: {
    executions_total: number;
    templates_installed: number;
    workflows_active: number;
    top_categories: Array<{
      category: string;
      usage_count: number;
      success_rate: number;
    }>;
  };
  trends: {
    monthly_comparison: Array<{
      month: string;
      roi_usd: number;
      executions: number;
      users_active: number;
    }>;
  };
  recommendations: string[];
}

async function generateMonthlyReport(tenantId: string, month: string): Promise<MonthlyReport> {
  const startDate = `${month}-01`;
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
    .toISOString().split('T')[0];

  // Obtener datos del tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, plan')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Datos ejecutivos principales
  const { data: executiveData } = await supabase
    .rpc('get_monthly_executive_report', {
      p_tenant_id: tenantId,
      p_month: month
    });

  // KPIs del mes
  const { data: monthlyKPIs } = await supabase
    .from('kpi_rollups_monthly')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('month', month)
    .single();

  // Estadísticas de uso
  const { data: usageStats } = await supabase
    .rpc('get_monthly_usage_stats', {
      p_tenant_id: tenantId,
      p_month: month
    });

  // Tendencias trimestrales
  const { data: trends } = await supabase
    .rpc('get_quarterly_trends', {
      p_tenant_id: tenantId,
      p_end_month: month
    });

  // Categorías top
  const { data: topCategories } = await supabase
    .rpc('get_top_categories_monthly', {
      p_tenant_id: tenantId,
      p_month: month
    });

  // Generar recomendaciones basadas en datos
  const recommendations = generateRecommendations(monthlyKPIs, usageStats?.[0], executiveData?.[0]);

  // Generar logros clave
  const achievements = generateKeyAchievements(monthlyKPIs, executiveData?.[0]);

  const executive = executiveData?.[0] || {};
  const usage = usageStats?.[0] || {};

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan
    },
    period: {
      month,
      start_date: startDate,
      end_date: endDate
    },
    executive_summary: {
      roi_usd: executive.roi_usd || 0,
      roi_trend: executive.roi_trend || 0,
      hours_saved_total: executive.hours_saved_total || 0,
      cost_total_usd: executive.cost_total_usd || 0,
      net_savings_usd: executive.net_savings_usd || 0,
      savings_multiple: executive.savings_multiple || 0,
      key_achievements: achievements
    },
    kpis: {
      ttv_days_avg: monthlyKPIs?.ttv_days_avg || 0,
      adoption_rate: monthlyKPIs?.adoption_rate || 0,
      success_rate: usage.success_rate || 0,
      user_growth: usage.user_growth || 0
    },
    usage_stats: {
      executions_total: usage.executions_total || 0,
      templates_installed: usage.templates_installed || 0,
      workflows_active: usage.workflows_active || 0,
      top_categories: topCategories || []
    },
    trends: {
      monthly_comparison: trends || []
    },
    recommendations
  };
}

function generateKeyAchievements(monthlyKPIs: any, executiveData: any): string[] {
  const achievements: string[] = [];

  if (executiveData?.roi_usd > 5000) {
    achievements.push(`🎯 ROI excepcional: ${formatCurrency(executiveData.roi_usd)} generados`);
  }

  if (executiveData?.hours_saved_total > 500) {
    achievements.push(`⏰ Impacto significativo: ${executiveData.hours_saved_total} horas ahorradas`);
  }

  if (monthlyKPIs?.ttv_days_avg < 7) {
    achievements.push(`🚀 Time To Value excelente: ${monthlyKPIs.ttv_days_avg.toFixed(1)} días promedio`);
  }

  if (monthlyKPIs?.adoption_rate > 80) {
    achievements.push(`📈 Alta adopción: ${monthlyKPIs.adoption_rate.toFixed(1)}% de usuarios adoptaron la plataforma`);
  }

  if (executiveData?.savings_multiple > 3) {
    achievements.push(`💰 ROI excepcional: ${executiveData.savings_multiple.toFixed(1)}x retorno sobre inversión`);
  }

  if (achievements.length === 0) {
    achievements.push('📊 Crecimiento consistente en métricas clave');
  }

  return achievements.slice(0, 4); // Máximo 4 logros
}

function generateRecommendations(monthlyKPIs: any, usageStats: any, executiveData: any): string[] {
  const recommendations: string[] = [];

  // Recomendaciones basadas en ROI
  if (executiveData?.roi_usd < 1000) {
    recommendations.push('💡 Aumentar focus en templates de alto impacto para mejorar ROI');
  }

  // Recomendaciones basadas en TTV
  if (monthlyKPIs?.ttv_days_avg > 14) {
    recommendations.push('🎯 Optimizar proceso de onboarding para reducir Time To Value');
  }

  // Recomendaciones basadas en adopción
  if (monthlyKPIs?.adoption_rate < 60) {
    recommendations.push('👥 Implementar programa de training para aumentar adopción');
  }

  // Recomendaciones basadas en éxito
  if (usageStats?.success_rate < 85) {
    recommendations.push('🔧 Revisar templates con mayor tasa de error para optimización');
  }

  // Recomendaciones basadas en costo-beneficio
  if (executiveData?.savings_multiple < 2) {
    recommendations.push('⚡ Explorar workflows de automatización más eficientes');
  }

  // Recomendación general si hay pocas ejecuciones
  if (usageStats?.executions_total < 100) {
    recommendations.push('🚀 Incentivar mayor uso de la plataforma con casos de uso específicos');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Mantener el excelente performance actual');
    recommendations.push('📊 Explorar nuevas oportunidades de automatización');
  }

  return recommendations.slice(0, 5); // Máximo 5 recomendaciones
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function generateHTMLReport(report: MonthlyReport): string {
  const monthName = new Date(report.period.start_date).toLocaleDateString('es-AR', { 
    year: 'numeric', 
    month: 'long' 
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte Mensual Analytics - ${monthName}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f8fafc;
            color: #334155;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .section { margin-bottom: 40px; }
        .section h2 { 
            color: #1e293b; 
            border-bottom: 2px solid #e2e8f0; 
            padding-bottom: 10px; 
            margin-bottom: 20px;
            font-size: 20px;
        }
        .kpi-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .kpi-card { 
            background: #f8fafc; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #3b82f6; 
            text-align: center; 
        }
        .kpi-value { 
            font-size: 24px; 
            font-weight: 700; 
            color: #1e293b; 
            margin-bottom: 5px; 
        }
        .kpi-label { 
            font-size: 12px; 
            color: #64748b; 
            text-transform: uppercase; 
            font-weight: 500; 
        }
        .roi-positive { color: #059669; }
        .roi-negative { color: #dc2626; }
        .achievement { 
            background: #ecfdf5; 
            border-left: 4px solid #10b981; 
            padding: 15px; 
            margin-bottom: 10px; 
            border-radius: 4px; 
        }
        .recommendation { 
            background: #fffbeb; 
            border-left: 4px solid #f59e0b; 
            padding: 15px; 
            margin-bottom: 10px; 
            border-radius: 4px; 
        }
        .trend-positive { color: #059669; }
        .trend-negative { color: #dc2626; }
        .category-item { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px solid #e2e8f0; 
        }
        .footer { 
            background: #f1f5f9; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #64748b; 
        }
        .executive-summary {
            background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        .metric-highlight {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Reporte Analytics Mensual</h1>
            <p>${report.tenant.name} • ${monthName} • Plan ${report.tenant.plan}</p>
        </div>
        
        <div class="content">
            <!-- Resumen Ejecutivo -->
            <div class="section">
                <h2>🎯 Resumen Ejecutivo</h2>
                <div class="executive-summary">
                    <div class="summary-grid">
                        <div class="metric-highlight">
                            <div class="kpi-value ${report.executive_summary.roi_usd >= 0 ? 'roi-positive' : 'roi-negative'}">
                                ${formatCurrency(report.executive_summary.roi_usd)}
                            </div>
                            <div class="kpi-label">ROI Total</div>
                        </div>
                        <div class="metric-highlight">
                            <div class="kpi-value">${report.executive_summary.hours_saved_total.toLocaleString()}</div>
                            <div class="kpi-label">Horas Ahorradas</div>
                        </div>
                        <div class="metric-highlight">
                            <div class="kpi-value">${report.executive_summary.savings_multiple.toFixed(1)}x</div>
                            <div class="kpi-label">Múltiplo ROI</div>
                        </div>
                    </div>
                </div>
                
                <h3>🏆 Logros Clave del Mes</h3>
                ${report.executive_summary.key_achievements.map(achievement => 
                    `<div class="achievement">${achievement}</div>`
                ).join('')}
            </div>

            <!-- KPIs Principales -->
            <div class="section">
                <h2>📈 KPIs Principales</h2>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-value">${report.kpis.ttv_days_avg.toFixed(1)}</div>
                        <div class="kpi-label">Días TTV Promedio</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${report.kpis.adoption_rate.toFixed(1)}%</div>
                        <div class="kpi-label">Tasa Adopción</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${report.kpis.success_rate.toFixed(1)}%</div>
                        <div class="kpi-label">Tasa Éxito</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${report.kpis.user_growth > 0 ? '+' : ''}${report.kpis.user_growth.toFixed(1)}%</div>
                        <div class="kpi-label">Crecimiento Usuarios</div>
                    </div>
                </div>
            </div>

            <!-- Estadísticas de Uso -->
            <div class="section">
                <h2>🔧 Estadísticas de Uso</h2>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-value">${report.usage_stats.executions_total.toLocaleString()}</div>
                        <div class="kpi-label">Ejecuciones Total</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${report.usage_stats.templates_installed}</div>
                        <div class="kpi-label">Templates Instalados</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${report.usage_stats.workflows_active}</div>
                        <div class="kpi-label">Workflows Activos</div>
                    </div>
                </div>

                <h3>📦 Categorías Más Utilizadas</h3>
                ${report.usage_stats.top_categories.slice(0, 5).map(cat => 
                    `<div class="category-item">
                        <span><strong>${cat.category}</strong></span>
                        <span>${cat.usage_count} usos (${cat.success_rate.toFixed(1)}% éxito)</span>
                    </div>`
                ).join('')}
            </div>

            <!-- Recomendaciones -->
            <div class="section">
                <h2>💡 Recomendaciones</h2>
                ${report.recommendations.map(rec => 
                    `<div class="recommendation">${rec}</div>`
                ).join('')}
            </div>
        </div>
        
        <div class="footer">
            <p>Reporte generado automáticamente el ${new Date().toLocaleDateString('es-AR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</p>
            <p>🤖 Powered by RP9 Analytics Platform</p>
        </div>
    </div>
</body>
</html>`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const params = new URLSearchParams(event.queryStringParameters || '');
    const type = params.get('type') || 'monthly';
    const month = params.get('month');
    const tenantId = params.get('tenant_id');
    const format = params.get('format') || 'html';

    if (!month || !tenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'month and tenant_id are required' })
      };
    }

    if (type !== 'monthly') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Only monthly reports are supported currently' })
      };
    }

    // Rate limiting
    const allowed = await checkRateLimit(`analytics-report:${tenantId}`, 10); // 10/min
    if (!allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
    }

    // Generar el reporte
    const report = await generateMonthlyReport(tenantId, month);

    if (format === 'json') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      };
    }

    // Generar HTML por defecto
    const htmlReport = generateHTMLReport(report);

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="reporte-analytics-${month}-${tenantId}.html"`
      },
      body: htmlReport
    };

  } catch (error) {
    console.error('Analytics report error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Report generation failed' })
    };
  }
};