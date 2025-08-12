-- 006_onboarding_ttv.sql — Fase 5: Onboarding & Time-to-Value

-- Template catalog for onboarding
create table if not exists template_catalog (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  vertical text not null check (vertical in ('cc','fin')),
  level text not null check (level in ('mock','real')),
  description text,
  price_usd numeric default 0,
  nodes jsonb default '[]'::jsonb,
  metadata jsonb default '{}',
  country text, -- Specific country targeting
  created_at timestamptz default now()
);

-- Country-specific template ordering
create table if not exists country_template_order (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  codes text[] not null, -- Array of template codes in order
  created_at timestamptz default now()
);

create unique index if not exists uq_country_order on country_template_order(country);

-- Onboarding tasks definition
create table if not exists onboarding_tasks (
  key text primary key,
  title text not null,
  description text,
  critical boolean default false,
  vertical text default null, -- cc, fin, or null for all
  sort int default 0
);

-- User progress through onboarding
create table if not exists onboarding_progress (
  id bigserial primary key,
  tenant_id uuid not null,
  user_id uuid,
  task_key text references onboarding_tasks(key) on delete cascade,
  status text not null check (status in ('pending','done','error')),
  meta jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_onb_progress_tenant on onboarding_progress(tenant_id, created_at desc);

-- Activation events for business outcomes tracking
create table if not exists activation_events (
  id bigserial primary key,
  tenant_id uuid not null,
  type text not null, -- 'ticket_created', 'invoice_validated', 'workflow_executed', etc.
  workflow_id text,
  execution_id text,
  occurred_at timestamptz not null default now(),
  meta jsonb default '{}'
);

create index if not exists idx_activation_tenant on activation_events(tenant_id, occurred_at desc);
create index if not exists idx_activation_type on activation_events(type, occurred_at desc);

-- Health score snapshots
create table if not exists health_snapshots (
  id bigserial primary key,
  tenant_id uuid not null,
  score numeric not null check (score >= 0 and score <= 100),
  breakdown jsonb not null, -- {"outcome": 50, "integrations": 30, "usage": 20}
  created_at timestamptz default now()
);

create index if not exists idx_health_snapshots_tenant on health_snapshots(tenant_id, created_at desc);

-- Onboarding notifications tracking
create table if not exists onboarding_notifications (
  id bigserial primary key,
  tenant_id uuid not null,
  user_id uuid,
  type text not null, -- 'digest', 'milestone', 'reminder'
  channel text not null, -- 'in-app', 'email', 'whatsapp'
  sent_at timestamptz default now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  meta jsonb default '{}'
);

create index if not exists idx_onb_notifications_tenant on onboarding_notifications(tenant_id, sent_at desc);

-- Enable RLS on all tables
alter table template_catalog enable row level security;
alter table country_template_order enable row level security;
alter table onboarding_tasks enable row level security;
alter table onboarding_progress enable row level security;
alter table activation_events enable row level security;
alter table health_snapshots enable row level security;
alter table onboarding_notifications enable row level security;

-- Public read policies for catalog and tasks
create policy tc_read_all on template_catalog for select using (true);
create policy cto_read_all on country_template_order for select using (true);
create policy ont_read_all on onboarding_tasks for select using (true);

-- Tenant-specific policies for progress and events
create policy onb_progress_tenant on onboarding_progress for all
  using (tenant_id in (select id from tenants where owner_user = auth.uid()));

create policy activation_tenant on activation_events for all
  using (tenant_id in (select id from tenants where owner_user = auth.uid()));

create policy health_tenant on health_snapshots for all
  using (tenant_id in (select id from tenants where owner_user = auth.uid()));

create policy notifications_tenant on onboarding_notifications for all
  using (tenant_id in (select id from tenants where owner_user = auth.uid()));

-- Insert initial onboarding tasks
insert into onboarding_tasks (key, title, description, critical, vertical, sort) values
  ('select_vertical', 'Seleccionar vertical', 'Elegir entre Contact Center o Finanzas', true, null, 1),
  ('connect_integration', 'Conectar integración', 'Conectar al menos una integración', true, null, 2),
  ('install_templates', 'Instalar plantillas', 'Instalar plantillas mock y real', true, null, 3),
  ('execute_mock', 'Ejecutar mock', 'Ejecutar plantilla mock para ver resultados', true, null, 4),
  ('configure_real', 'Configurar real', 'Completar credenciales de plantilla real', false, null, 5),
  ('first_business_outcome', 'Primer outcome', 'Generar primer resultado de negocio', true, null, 6),
  ('activate_account', 'Activar cuenta', 'Completar 5 ejecuciones + 1 outcome', true, null, 7)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  updated_at = now();

-- Insert sample templates for onboarding
insert into template_catalog (code, name, vertical, level, description, price_usd, nodes, metadata, country) values
  ('cc_mock_ticket', 'Mock: Crear Ticket', 'cc', 'mock', 'Simulación de creación de ticket en CRM', 0, 
   '[{"id":"1","name":"Manual Trigger","type":"n8n-nodes-base.manualTrigger"},{"id":"2","name":"Set (Mock Data)","type":"n8n-nodes-base.set"}]'::jsonb,
   '{"demo": true, "executes_immediately": true}', null),
  ('cc_real_hubspot', 'Real: HubSpot CRM', 'cc', 'real', 'Integración real con HubSpot para Contact Center', 0,
   '[{"id":"1","name":"Webhook Trigger","type":"n8n-nodes-base.webhook"},{"id":"2","name":"HubSpot","type":"n8n-nodes-base.hubspot"}]'::jsonb,
   '{"requires_auth": true, "oauth_provider": "hubspot"}', null),
  ('fin_mock_invoice', 'Mock: Validar Factura', 'fin', 'mock', 'Simulación de validación de factura', 0,
   '[{"id":"1","name":"Manual Trigger","type":"n8n-nodes-base.manualTrigger"},{"id":"2","name":"Set (Mock Data)","type":"n8n-nodes-base.set"}]'::jsonb,
   '{"demo": true, "executes_immediately": true}', null),
  ('fin_real_quickbooks', 'Real: QuickBooks', 'fin', 'real', 'Integración real con QuickBooks', 0,
   '[{"id":"1","name":"Webhook Trigger","type":"n8n-nodes-base.webhook"},{"id":"2","name":"QuickBooks","type":"n8n-nodes-base.quickbooks"}]'::jsonb,
   '{"requires_auth": true, "oauth_provider": "quickbooks"}', null)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  nodes = excluded.nodes,
  metadata = excluded.metadata;

-- Insert country-specific template ordering
insert into country_template_order (country, codes) values
  ('MX', array['cc_mock_ticket', 'cc_real_hubspot', 'fin_mock_invoice', 'fin_real_quickbooks']),
  ('CO', array['cc_mock_ticket', 'cc_real_hubspot', 'fin_mock_invoice', 'fin_real_quickbooks']),
  ('CL', array['cc_mock_ticket', 'cc_real_hubspot', 'fin_mock_invoice', 'fin_real_quickbooks']),
  ('AR', array['cc_mock_ticket', 'cc_real_hubspot', 'fin_mock_invoice', 'fin_real_quickbooks']),
  ('PE', array['cc_mock_ticket', 'cc_real_hubspot', 'fin_mock_invoice', 'fin_real_quickbooks']),
  ('default', array['cc_mock_ticket', 'cc_real_hubspot', 'fin_mock_invoice', 'fin_real_quickbooks'])
on conflict (country) do update set
  codes = excluded.codes;

-- Function to calculate health score
create or replace function calculate_health_score(p_tenant_id uuid)
returns jsonb as $$
declare
  outcome_score numeric := 0;
  integration_score numeric := 0;
  usage_score numeric := 0;
  total_score numeric := 0;
begin
  -- Outcome score (50%): Has business outcomes
  select case when count(*) > 0 then 50 else 0 end
  into outcome_score
  from activation_events
  where tenant_id = p_tenant_id 
    and type in ('ticket_created', 'invoice_validated', 'business_outcome');

  -- Integration score (30%): Number of connected integrations
  select least(30, count(*) * 10)
  into integration_score
  from onboarding_progress
  where tenant_id = p_tenant_id 
    and task_key = 'connect_integration'
    and status = 'done';

  -- Usage score (20%): Workflow executions
  select case 
    when count(*) >= 5 then 20
    when count(*) >= 2 then 15
    when count(*) >= 1 then 10
    else 0
  end
  into usage_score
  from usage_executions
  where tenant_id = p_tenant_id
    and started_at > now() - interval '7 days';

  total_score := outcome_score + integration_score + usage_score;

  return jsonb_build_object(
    'total', total_score,
    'outcome', outcome_score,
    'integrations', integration_score,
    'usage', usage_score,
    'calculated_at', now()
  );
end;
$$ language plpgsql;

-- Function to check activation status
create or replace function is_tenant_activated(p_tenant_id uuid)
returns boolean as $$
declare
  has_outcome boolean := false;
  execution_count int := 0;
begin
  -- Check for business outcome
  select exists(
    select 1 from activation_events
    where tenant_id = p_tenant_id 
      and type in ('ticket_created', 'invoice_validated', 'business_outcome')
  ) into has_outcome;

  -- Check execution count
  select count(*)
  into execution_count
  from usage_executions
  where tenant_id = p_tenant_id;

  return has_outcome and execution_count >= 5;
end;
$$ language plpgsql;

-- View for onboarding dashboard
create or replace view onboarding_dashboard as
select 
  t.id as tenant_id,
  t.name as tenant_name,
  coalesce(calc.total, 0) as health_score,
  is_tenant_activated(t.id) as is_activated,
  (select count(*) from onboarding_progress op where op.tenant_id = t.id and op.status = 'done') as completed_tasks,
  (select count(*) from onboarding_tasks) as total_tasks,
  (select count(*) from usage_executions ue where ue.tenant_id = t.id) as total_executions,
  (select count(*) from activation_events ae where ae.tenant_id = t.id) as total_outcomes
from tenants t
left join lateral calculate_health_score(t.id) calc on true;

comment on table template_catalog is 'Catalog of templates available for onboarding';
comment on table country_template_order is 'Country-specific ordering of templates';
comment on table onboarding_tasks is 'Definition of onboarding tasks';
comment on table onboarding_progress is 'User progress through onboarding tasks';
comment on table activation_events is 'Business outcome events for activation tracking';
comment on table health_snapshots is 'Snapshots of tenant health scores over time';
comment on table onboarding_notifications is 'Tracking of onboarding notifications sent';