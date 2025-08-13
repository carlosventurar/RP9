/**
 * Analytics Ingest Function
 * Recibe eventos del frontend/BFF para tracking de funnel y outcomes
 * POST /api/analytics/ingest
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifySignature } from '../../lib/security/hmac';
import { checkRateLimit } from '../../lib/security/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface IngestEvent {
  type: 'funnel' | 'outcome';
  tenant_id: string;
  user_id?: string;
  event_name: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface OutcomeEvent extends IngestEvent {
  type: 'outcome';
  outcome_type: 'first_victory' | 'continuous';
  category: 'cfdi' | 'ticket' | 'email' | 'payment' | 'invoice' | 'report' | 'other';
  value_usd?: number;
  hours_saved?: number;
}

interface FunnelEvent extends IngestEvent {
  type: 'funnel';
  step: 'wizard_start' | 'template_install' | 'first_execution' | 'first_success';
  template_id?: string;
  workflow_id?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = event.body;
    if (!body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Body required' }) };
    }

    // Verificar signature HMAC para seguridad
    const signature = event.headers['x-rp9-signature'];
    const timestamp = event.headers['x-rp9-timestamp'];
    
    if (!signature || !timestamp) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing signature headers' }) };
    }

    const isValid = verifySignature(
      body,
      timestamp,
      signature,
      process.env.ANALYTICS_WEBHOOK_SECRET!,
      300 // 5 minutos de tolerancia
    );

    if (!isValid) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    }

    const data: IngestEvent = JSON.parse(body);

    // Validaciones básicas
    if (!data.type || !data.tenant_id || !data.event_name) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing required fields: type, tenant_id, event_name' }) 
      };
    }

    // Rate limiting por tenant
    const allowed = await checkRateLimit(`analytics:${data.tenant_id}`, 1000); // 1000/min por tenant
    if (!allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
    }

    const now = new Date().toISOString();
    
    if (data.type === 'funnel') {
      const funnelData = data as FunnelEvent;
      
      // Insertar evento en funnel_events
      const { error: funnelError } = await supabase
        .from('funnel_events')
        .insert({
          tenant_id: funnelData.tenant_id,
          user_id: funnelData.user_id,
          step: funnelData.step,
          event_name: funnelData.event_name,
          template_id: funnelData.template_id,
          workflow_id: funnelData.workflow_id,
          metadata: funnelData.metadata || {},
          created_at: funnelData.timestamp || now
        });

      if (funnelError) {
        console.error('Error inserting funnel event:', funnelError);
        return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
      }

    } else if (data.type === 'outcome') {
      const outcomeData = data as OutcomeEvent;
      
      // Validar campos específicos de outcome
      if (!outcomeData.outcome_type || !outcomeData.category) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ error: 'Missing outcome_type or category' }) 
        };
      }

      // Insertar outcome
      const { error: outcomeError } = await supabase
        .from('outcomes')
        .insert({
          tenant_id: outcomeData.tenant_id,
          user_id: outcomeData.user_id,
          outcome_type: outcomeData.outcome_type,
          category: outcomeData.category,
          event_name: outcomeData.event_name,
          value_usd: outcomeData.value_usd,
          hours_saved: outcomeData.hours_saved,
          metadata: outcomeData.metadata || {},
          created_at: outcomeData.timestamp || now
        });

      if (outcomeError) {
        console.error('Error inserting outcome:', outcomeError);
        return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
      }

      // Si es first_victory, marcar TTV achieved para el tenant
      if (outcomeData.outcome_type === 'first_victory') {
        const { error: updateError } = await supabase
          .rpc('update_ttv_achieved', { 
            p_tenant_id: outcomeData.tenant_id,
            p_achieved_at: outcomeData.timestamp || now
          });

        if (updateError) {
          console.error('Error updating TTV:', updateError);
          // No fallamos la request por esto, es secundario
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, timestamp: now })
    };

  } catch (error) {
    console.error('Analytics ingest error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Internal server error' }) 
    };
  }
};