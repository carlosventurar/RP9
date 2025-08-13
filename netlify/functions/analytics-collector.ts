/**
 * Analytics Collector Function - Scheduled
 * Extrae datos de ejecución de n8n y los ingresa en usage_executions
 * Ejecuta cada 15 minutos: 0,15,30,45 * * * *
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: 'manual' | 'trigger' | 'webhook' | 'error';
  startedAt: string;
  stoppedAt?: string;
  finished: boolean;
  status: 'success' | 'error' | 'running' | 'waiting';
  executionTime?: number;
  userId?: string;
  data?: {
    resultData?: {
      runData?: Record<string, any>;
    };
  };
}

interface WorkflowMetadata {
  tenant_id: string;
  template_id?: string;
  category?: string;
}

async function fetchN8nExecutions(since: string): Promise<N8nExecution[]> {
  const n8nUrl = process.env.N8N_WEBHOOK_URL?.replace('/webhook/', '/api/v1/executions');
  if (!n8nUrl) {
    throw new Error('N8N_WEBHOOK_URL not configured');
  }

  const response = await fetch(`${n8nUrl}?limit=100&lastId=${since}`, {
    headers: {
      'Authorization': `Bearer ${process.env.N8N_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`N8N API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function getWorkflowMetadata(workflowId: string): Promise<WorkflowMetadata | null> {
  // Buscar en tenant_workflows para obtener tenant_id y template_id
  const { data, error } = await supabase
    .from('tenant_workflows')
    .select(`
      tenant_id,
      template_id,
      templates(category)
    `)
    .eq('n8n_workflow_id', workflowId)
    .single();

  if (error || !data) {
    console.warn(`No metadata found for workflow ${workflowId}`);
    return null;
  }

  return {
    tenant_id: data.tenant_id,
    template_id: data.template_id,
    category: data.templates?.category
  };
}

function calculateExecutionCost(execution: N8nExecution): number {
  // Cálculo básico de costo basado en tiempo de ejecución
  const executionTimeMs = execution.executionTime || 0;
  const executionTimeMinutes = executionTimeMs / 1000 / 60;
  
  // $0.001 por minuto de ejecución (ajustable)
  const baseRate = 0.001;
  return Math.max(0.0001, executionTimeMinutes * baseRate); // Mínimo $0.0001
}

function extractNodeCounts(execution: N8nExecution): { total: number; errors: number } {
  let total = 0;
  let errors = 0;

  try {
    const runData = execution.data?.resultData?.runData;
    if (runData) {
      total = Object.keys(runData).length;
      
      // Contar nodos con errores
      Object.values(runData).forEach((nodeData: any) => {
        if (nodeData?.[0]?.error) {
          errors++;
        }
      });
    }
  } catch (e) {
    console.warn('Error parsing execution data:', e);
  }

  return { total, errors };
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
    console.log('Starting analytics collection...');

    // Obtener la última ejecución procesada
    const { data: lastExecution } = await supabase
      .from('usage_executions')
      .select('n8n_execution_id')
      .order('collected_at', { ascending: false })
      .limit(1)
      .single();

    const lastExecutionId = lastExecution?.n8n_execution_id || '0';
    
    // Fetch executions desde n8n
    const executions = await fetchN8nExecutions(lastExecutionId);
    console.log(`Found ${executions.length} new executions`);

    let processed = 0;
    let errors = 0;

    for (const execution of executions) {
      try {
        // Obtener metadata del workflow
        const metadata = await getWorkflowMetadata(execution.workflowId);
        if (!metadata) {
          console.warn(`Skipping execution ${execution.id} - no metadata`);
          continue;
        }

        // Calcular métricas
        const cost = calculateExecutionCost(execution);
        const { total: nodeCount, errors: nodeErrors } = extractNodeCounts(execution);
        
        // Insertar en usage_executions (idempotente por n8n_execution_id)
        const { error: insertError } = await supabase
          .from('usage_executions')
          .upsert({
            n8n_execution_id: execution.id,
            tenant_id: metadata.tenant_id,
            workflow_id: execution.workflowId,
            template_id: metadata.template_id,
            status: execution.status,
            mode: execution.mode,
            started_at: execution.startedAt,
            finished_at: execution.stoppedAt,
            execution_time_ms: execution.executionTime || 0,
            node_count: nodeCount,
            node_errors: nodeErrors,
            cost_usd: cost,
            category: metadata.category,
            collected_at: new Date().toISOString()
          }, {
            onConflict: 'n8n_execution_id'
          });

        if (insertError) {
          console.error(`Error inserting execution ${execution.id}:`, insertError);
          errors++;
        } else {
          processed++;
        }

      } catch (execError) {
        console.error(`Error processing execution ${execution.id}:`, execError);
        errors++;
      }
    }

    // Actualizar estadísticas de recolección
    await supabase
      .from('kpi_rollups_daily')
      .upsert({
        tenant_id: 'system',
        date: new Date().toISOString().split('T')[0],
        data_collected_executions: processed,
        data_collection_errors: errors,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,date'
      });

    console.log(`Analytics collection completed: ${processed} processed, ${errors} errors`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        processed,
        errors,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Analytics collector error:', error);
    
    // Log error para monitoring
    await supabase
      .from('kpi_rollups_daily')
      .upsert({
        tenant_id: 'system',
        date: new Date().toISOString().split('T')[0],
        data_collection_errors: 1,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,date'
      });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Collection failed' })
    };
  }
};