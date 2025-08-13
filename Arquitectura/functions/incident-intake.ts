import { Handler } from '@netlify/functions';

type Severity = 'P1'|'P2'|'P3'|'P4';

export const handler: Handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const { severity, title, description, affected_tenants=[] } = body as { severity: Severity, title: string, description?: string, affected_tenants?: string[] };
  if (!severity || !title) return { statusCode: 400, body: 'missing fields' };
  // TODO: create ticket in tracker + notify Slack/Email + start timer for SLA
  return { statusCode: 200, body: JSON.stringify({ ok: true, severity, title }) };
};