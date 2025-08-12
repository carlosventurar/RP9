import type { Handler } from '@netlify/functions'

interface AlertPayload {
  sev?: 'sev1' | 'sev2' | 'sev3' | 'info';
  title?: string;
  desc?: string;
  meta?: Record<string, any>;
  tenant_id?: string;
  source?: string;
}

async function postSlack(webhook: string, payload: any) {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Slack notification failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendEmail(payload: AlertPayload) {
  // Placeholder for email integration (SendGrid, etc.)
  console.log('Email alert would be sent:', payload);
  return { success: true };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  try {
    const {
      sev = 'info',
      title = 'Alert',
      desc = '',
      meta = {},
      tenant_id,
      source = 'system'
    }: AlertPayload = JSON.parse(event.body || '{}');

    // Validate severity
    if (!['sev1', 'sev2', 'sev3', 'info'].includes(sev)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid severity level' })
      };
    }

    const webhook = process.env.ALERTS_SLACK_WEBHOOK;
    const results: any = {};

    // Send Slack notification if webhook is configured
    if (webhook) {
      const color = sev === 'sev1' ? '#ff0000' : sev === 'sev2' ? '#ff9900' : sev === 'sev3' ? '#ffcc00' : '#36a64f';
      const urgencyEmoji = sev === 'sev1' ? '🚨' : sev === 'sev2' ? '⚠️' : sev === 'sev3' ? '⚡' : 'ℹ️';
      
      const slackPayload = {
        text: `${urgencyEmoji} ${title}`,
        attachments: [{
          color,
          title: `[${sev.toUpperCase()}] ${title}`,
          text: desc,
          fields: [
            ...Object.entries(meta).map(([k, v]) => ({ 
              title: k, 
              value: String(v), 
              short: true 
            })),
            ...(tenant_id ? [{ title: 'Tenant', value: tenant_id, short: true }] : []),
            { title: 'Source', value: source, short: true },
            { title: 'Timestamp', value: new Date().toISOString(), short: true }
          ],
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      results.slack = await postSlack(webhook, slackPayload);
    } else {
      results.slack = { success: false, error: 'ALERTS_SLACK_WEBHOOK not configured' };
    }

    // Send email for high severity alerts (Sev1, Sev2)
    if (['sev1', 'sev2'].includes(sev)) {
      results.email = await sendEmail({ sev, title, desc, meta, tenant_id, source });
    }

    // Log the alert to audit system
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_log`, {
          method: 'POST',
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'alert.dispatched',
            resource: `alert/${sev}`,
            meta: {
              title,
              desc,
              severity: sev,
              source,
              results,
              ...meta
            },
            tenant_id: tenant_id || null,
            hash: 'placeholder' // Would implement proper hash generation
          })
        });
      } catch (error) {
        console.error('Failed to log alert to audit system:', error);
      }
    }

    const statusCode = Object.values(results).some((r: any) => r.success) ? 200 : 500;
    
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: statusCode === 200,
        severity: sev,
        title,
        results,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Alert dispatch error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};