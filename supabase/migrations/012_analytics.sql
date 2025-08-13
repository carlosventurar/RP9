-- RP9 Fase 11: Analítica & Reporting
-- Migration: 012_analytics.sql
-- Date: 2025-08-13

-- ============================================================================
-- FUNNEL EVENTS & TRACKING
-- ============================================================================

-- Eventos de funnel para cohorts y tracking de conversión
create table if not exists funnel_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,                           -- opcional para usuarios anónimos
  session_id text not null,               -- tracking de sesión
  step text not null,                     -- wizard_start, wizard_complete, template_install, first_execution, first_outcome
  funnel_type text not null,              -- onboarding, activation, retention, expansion
  workflow_id text,                       -- id del workflow relacionado
  template_key text,                      -- key del template usado
  pack_category text,                     -- categoría del pack/template
  meta jsonb default '{}',                -- metadata adicional (UTM, device, etc.)
  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Outcomes de negocio (primera victoria + outcomes continuos)
create table if not exists outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workflow_id text not null,              -- workflow que generó el outcome
  execution_id text,                      -- id de ejecución específica
  kind text not null,                     -- cfdi_generated, ticket_resolved, email_sent, lead_captured, payment_processed
  category text not null,                 -- billing, support, marketing, sales, operations
  value_numeric decimal(12,2),            -- valor numérico del outcome (monto, cantidad, etc.)
  value_currency text default 'USD',     -- moneda del valor
  meta jsonb default '{}',                -- metadata específica del outcome
  is_first_victory boolean default false, -- marca si es la primera victoria del tenant
  occurred_at timestamptz not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- SAVINGS & COST CALCULATION
-- ============================================================================

-- Baseline de ahorro por tenant y workflow
create table if not exists savings_baseline (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workflow_id text not null,
  minutes_per_event decimal(8,2) not null default 0, -- minutos ahorrados por ejecución
  hourly_cost decimal(8,2) not null default 25.0,    -- costo por hora en USD
  baseline_method text not null,          -- template_default, user_survey, admin_override
  confidence_level text default 'medium', -- low, medium, high
  notes text,
  updated_by text,                        -- quien actualizó el baseline
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, workflow_id)
);

-- Metadata de templates con tiempo estimado por defecto
create table if not exists templates_metadata (
  id uuid primary key default gen_random_uuid(),
  workflow_key text unique not null,      -- key único del template
  name_es text not null,
  name_en text not null,
  category text not null,                 -- billing, support, marketing, etc.
  pack_name text,                         -- nombre del pack al que pertenece
  default_minutes_per_event decimal(8,2) not null default 30.0,
  complexity_level text default 'medium', -- simple, medium, complex
  estimated_setup_minutes int default 15,
  tags text[] default '{}',
  description_es text,
  description_en text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- USAGE & EXECUTIONS TRACKING
-- ============================================================================

-- Ejecuciones recolectadas de n8n (idempotente)
create table if not exists usage_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  n8n_execution_id text unique not null,  -- id único de n8n
  workflow_id text not null,
  workflow_name text,
  status text not null,                   -- success, error, running, waiting, cancelled
  mode text not null,                     -- webhook, manual, trigger, schedule
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_ms bigint,                     -- duración en milisegundos
  error_message text,
  execution_data jsonb,                   -- data completa de la ejecución (limitada)
  processed_at timestamptz default now()
);

-- ============================================================================
-- ROLLUPS & AGGREGATED DATA
-- ============================================================================

-- Rollups diarios por tenant
create table if not exists kpi_rollups_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  date date not null,
  
  -- Executions metrics
  total_executions int default 0,
  successful_executions int default 0,
  failed_executions int default 0,
  avg_duration_ms bigint default 0,
  p95_duration_ms bigint default 0,
  
  -- Funnel metrics
  funnel_wizard_starts int default 0,
  funnel_wizard_completes int default 0,
  funnel_template_installs int default 0,
  funnel_first_executions int default 0,
  funnel_first_outcomes int default 0,
  
  -- Outcomes metrics
  total_outcomes int default 0,
  outcomes_by_category jsonb default '{}',
  total_outcome_value decimal(12,2) default 0,
  
  -- Savings metrics
  estimated_hours_saved decimal(8,2) default 0,
  estimated_cost_saved decimal(10,2) default 0,
  
  -- Health metrics
  active_workflows int default 0,
  error_rate decimal(4,3) default 0,
  
  created_at timestamptz default now(),
  unique(tenant_id, date)
);

-- Rollups mensuales por tenant
create table if not exists kpi_rollups_monthly (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  month date not null, -- primer día del mes
  
  -- Executions metrics
  total_executions int default 0,
  successful_executions int default 0,
  failed_executions int default 0,
  avg_duration_ms bigint default 0,
  p95_duration_ms bigint default 0,
  
  -- Conversion funnel
  funnel_conversion_rates jsonb default '{}',
  
  -- TTV metrics
  ttv_cohort_week text,
  ttv_hours_p50 decimal(6,2),
  ttv_hours_p75 decimal(6,2),
  activation_rate decimal(4,3),
  
  -- ROI metrics
  estimated_hours_saved decimal(10,2) default 0,
  estimated_cost_saved decimal(12,2) default 0,
  subscription_cost decimal(10,2) default 0,
  roi_usd decimal(12,2) default 0,
  
  -- Pack adoption
  pack_adoption_metrics jsonb default '{}',
  
  -- Health score
  avg_health_score decimal(4,1),
  
  created_at timestamptz default now(),
  unique(tenant_id, month)
);

-- ============================================================================
-- MATERIALIZED VIEWS
-- ============================================================================

-- Vista materializada: Funnels diarios
create materialized view if not exists mv_funnels_daily as
select 
  tenant_id,
  date_trunc('day', occurred_at) as day,
  funnel_type,
  step,
  count(*) as events_count,
  count(distinct session_id) as unique_sessions,
  count(distinct user_id) filter(where user_id is not null) as unique_users
from funnel_events 
where occurred_at >= current_date - interval '90 days'
group by tenant_id, date_trunc('day', occurred_at), funnel_type, step;

-- Vista materializada: Cohorts TTV semanales
create materialized view if not exists mv_ttv_cohorts_weekly as
with cohorts as (
  select 
    tenant_id,
    date_trunc('week', occurred_at) as cohort_week,
    session_id,
    min(occurred_at) filter(where step = 'wizard_start') as signup_time,
    min(occurred_at) filter(where step = 'first_outcome') as first_outcome_time
  from funnel_events
  where step in ('wizard_start', 'first_outcome')
    and occurred_at >= current_date - interval '12 weeks'
  group by tenant_id, date_trunc('week', occurred_at), session_id
  having min(occurred_at) filter(where step = 'wizard_start') is not null
)
select 
  tenant_id,
  cohort_week,
  count(*) as cohort_size,
  count(first_outcome_time) as activated_users,
  count(first_outcome_time)::decimal / count(*) as activation_rate,
  percentile_cont(0.5) within group (
    order by extract(epoch from (first_outcome_time - signup_time))/3600
  ) filter(where first_outcome_time is not null) as ttv_hours_p50,
  percentile_cont(0.75) within group (
    order by extract(epoch from (first_outcome_time - signup_time))/3600
  ) filter(where first_outcome_time is not null) as ttv_hours_p75
from cohorts
group by tenant_id, cohort_week;

-- Vista materializada: Adopción por pack
create materialized view if not exists mv_adoption_pack as
with pack_usage as (
  select 
    e.tenant_id,
    date_trunc('month', e.processed_at) as month,
    tm.pack_name,
    tm.category,
    count(distinct e.workflow_id) as workflows_used,
    count(*) as total_executions,
    count(*) filter(where e.status = 'success') as successful_executions,
    count(distinct o.id) as outcomes_generated
  from usage_executions e
  left join templates_metadata tm on e.workflow_id = tm.workflow_key
  left join outcomes o on e.n8n_execution_id = o.execution_id
  where e.processed_at >= current_date - interval '12 months'
    and tm.pack_name is not null
  group by e.tenant_id, date_trunc('month', e.processed_at), tm.pack_name, tm.category
)
select 
  tenant_id,
  month,
  pack_name,
  category,
  workflows_used,
  total_executions,
  successful_executions,
  outcomes_generated,
  case 
    when workflows_used >= 2 and total_executions >= 30 and outcomes_generated > 0 
    then true 
    else false 
  end as is_adopted,
  successful_executions::decimal / nullif(total_executions, 0) as success_rate
from pack_usage;

-- Vista materializada: NSM en USD (ROI mensual)
create materialized view if not exists mv_nsm_usd as
with monthly_savings as (
  select 
    e.tenant_id,
    date_trunc('month', e.processed_at) as month,
    sum(
      case 
        when e.status = 'success' and sb.minutes_per_event > 0 
        then (sb.minutes_per_event / 60.0) * sb.hourly_cost
        else tm.default_minutes_per_event / 60.0 * 25.0 -- fallback default
      end
    ) as estimated_cost_saved,
    count(*) filter(where e.status = 'success') as successful_executions,
    sum(sb.minutes_per_event / 60.0) filter(where e.status = 'success') as hours_saved
  from usage_executions e
  left join savings_baseline sb on e.tenant_id = sb.tenant_id and e.workflow_id = sb.workflow_id
  left join templates_metadata tm on e.workflow_id = tm.workflow_key
  where e.processed_at >= current_date - interval '12 months'
  group by e.tenant_id, date_trunc('month', e.processed_at)
),
subscription_costs as (
  select 
    tenant_id,
    date_trunc('month', created_at) as month,
    -- TODO: Obtener de billing actual, por ahora estimado por plan
    case 
      when plan = 'starter' then 29.0
      when plan = 'pro' then 99.0  
      when plan = 'enterprise' then 299.0
      else 29.0
    end as monthly_cost
  from tenants 
  where created_at >= current_date - interval '12 months'
)
select 
  ms.tenant_id,
  ms.month,
  ms.estimated_cost_saved,
  coalesce(sc.monthly_cost, 29.0) as subscription_cost,
  ms.estimated_cost_saved - coalesce(sc.monthly_cost, 29.0) as roi_usd,
  ms.successful_executions,
  ms.hours_saved,
  ms.estimated_cost_saved / nullif(ms.hours_saved, 0) as cost_per_hour_saved
from monthly_savings ms
left join subscription_costs sc on ms.tenant_id = sc.tenant_id and ms.month = sc.month;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Funnel events indexes
create index if not exists idx_funnel_events_tenant_occurred on funnel_events(tenant_id, occurred_at desc);
create index if not exists idx_funnel_events_step on funnel_events(step);
create index if not exists idx_funnel_events_session on funnel_events(session_id);
create index if not exists idx_funnel_events_workflow on funnel_events(workflow_id) where workflow_id is not null;

-- Outcomes indexes  
create index if not exists idx_outcomes_tenant_occurred on outcomes(tenant_id, occurred_at desc);
create index if not exists idx_outcomes_workflow on outcomes(workflow_id);
create index if not exists idx_outcomes_execution on outcomes(execution_id) where execution_id is not null;
create index if not exists idx_outcomes_first_victory on outcomes(tenant_id) where is_first_victory = true;

-- Usage executions indexes
create index if not exists idx_usage_executions_tenant_processed on usage_executions(tenant_id, processed_at desc);
create index if not exists idx_usage_executions_n8n_id on usage_executions(n8n_execution_id);
create index if not exists idx_usage_executions_workflow on usage_executions(workflow_id);
create index if not exists idx_usage_executions_status on usage_executions(status);

-- Rollups indexes
create index if not exists idx_kpi_rollups_daily_tenant_date on kpi_rollups_daily(tenant_id, date desc);
create index if not exists idx_kpi_rollups_monthly_tenant_month on kpi_rollups_monthly(tenant_id, month desc);

-- Baseline indexes
create index if not exists idx_savings_baseline_tenant_workflow on savings_baseline(tenant_id, workflow_id);

-- Templates metadata indexes  
create index if not exists idx_templates_metadata_workflow_key on templates_metadata(workflow_key);
create index if not exists idx_templates_metadata_category on templates_metadata(category);
create index if not exists idx_templates_metadata_pack on templates_metadata(pack_name) where pack_name is not null;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all analytics tables
alter table funnel_events enable row level security;
alter table outcomes enable row level security;
alter table savings_baseline enable row level security;
alter table templates_metadata enable row level security;
alter table usage_executions enable row level security;
alter table kpi_rollups_daily enable row level security;
alter table kpi_rollups_monthly enable row level security;

-- Policies for tenant isolation
create policy "Tenant isolation for funnel_events" on funnel_events
  for all using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

create policy "Tenant isolation for outcomes" on outcomes  
  for all using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

create policy "Tenant isolation for savings_baseline" on savings_baseline
  for all using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

create policy "Tenant isolation for usage_executions" on usage_executions
  for all using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

create policy "Tenant isolation for kpi_rollups_daily" on kpi_rollups_daily
  for all using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

create policy "Tenant isolation for kpi_rollups_monthly" on kpi_rollups_monthly  
  for all using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

-- Templates metadata - read-only for all tenants
create policy "Templates metadata read-only" on templates_metadata
  for select using (true);

-- Admin policies (for service role)
create policy "Admin full access funnel_events" on funnel_events
  for all using (current_setting('request.jwt.claims', true)::json->>'role' = '"service_role"');

create policy "Admin full access outcomes" on outcomes
  for all using (current_setting('request.jwt.claims', true)::json->>'role' = '"service_role"');

create policy "Admin full access savings_baseline" on savings_baseline  
  for all using (current_setting('request.jwt.claims', true)::json->>'role' = '"service_role"');

create policy "Admin full access usage_executions" on usage_executions
  for all using (current_setting('request.jwt.claims', true)::json->>'role' = '"service_role"');

create policy "Admin full access kpi_rollups_daily" on kpi_rollups_daily
  for all using (current_setting('request.jwt.claims', true)::json->>'role' = '"service_role"');

create policy "Admin full access kpi_rollups_monthly" on kpi_rollups_monthly
  for all using (current_setting('request.jwt.claims', true)::json->>'role' = '"service_role"');

create policy "Admin full access templates_metadata" on templates_metadata
  for all using (current_setting('request.jwt.claims', true)::json->>'role' = '"service_role"');

-- ============================================================================
-- SEED DATA - TEMPLATES METADATA
-- ============================================================================

insert into templates_metadata (workflow_key, name_es, name_en, category, pack_name, default_minutes_per_event, complexity_level, tags, description_es, description_en) values
  -- Billing Pack
  ('cfdi-generator', 'Generador de CFDI', 'CFDI Generator', 'billing', 'Facturación México', 45.0, 'medium', '{cfdi,facturacion,sat,mexico}', 'Automatiza la generación de CFDI para clientes', 'Automates CFDI generation for customers'),
  ('stripe-invoice', 'Facturación Stripe', 'Stripe Invoicing', 'billing', 'Billing Automation', 30.0, 'simple', '{stripe,invoice,billing}', 'Crea facturas automáticas en Stripe', 'Creates automatic invoices in Stripe'),
  ('payment-reconciliation', 'Conciliación de Pagos', 'Payment Reconciliation', 'billing', 'Finance Automation', 60.0, 'complex', '{payments,reconciliation,accounting}', 'Concilia pagos automáticamente', 'Automatically reconciles payments'),
  
  -- Support Pack  
  ('ticket-routing', 'Enrutamiento de Tickets', 'Ticket Routing', 'support', 'Customer Support', 15.0, 'simple', '{tickets,support,routing}', 'Enruta tickets automáticamente', 'Routes tickets automatically'),
  ('escalation-manager', 'Gestor de Escalamientos', 'Escalation Manager', 'support', 'Customer Support', 25.0, 'medium', '{escalation,support,sla}', 'Gestiona escalamientos de soporte', 'Manages support escalations'),
  ('kb-updater', 'Actualizador de KB', 'KB Updater', 'support', 'Knowledge Management', 20.0, 'simple', '{knowledge,documentation,updates}', 'Actualiza base de conocimiento', 'Updates knowledge base'),
  
  -- Marketing Pack
  ('lead-capture', 'Captura de Leads', 'Lead Capture', 'marketing', 'Lead Generation', 10.0, 'simple', '{leads,marketing,capture}', 'Captura leads automáticamente', 'Captures leads automatically'),
  ('email-campaign', 'Campaña de Email', 'Email Campaign', 'marketing', 'Email Marketing', 35.0, 'medium', '{email,marketing,campaigns}', 'Automatiza campañas de email', 'Automates email campaigns'),
  ('social-posting', 'Publicación Social', 'Social Media Posting', 'marketing', 'Social Media', 20.0, 'simple', '{social,posting,automation}', 'Publica en redes sociales', 'Posts to social media'),
  
  -- Sales Pack
  ('crm-sync', 'Sincronización CRM', 'CRM Sync', 'sales', 'CRM Integration', 25.0, 'medium', '{crm,sync,sales}', 'Sincroniza datos de CRM', 'Syncs CRM data'),
  ('quote-generator', 'Generador de Cotizaciones', 'Quote Generator', 'sales', 'Sales Automation', 40.0, 'medium', '{quotes,sales,generation}', 'Genera cotizaciones automáticas', 'Generates automatic quotes'),
  ('follow-up-sequences', 'Secuencias de Seguimiento', 'Follow-up Sequences', 'sales', 'Sales Automation', 30.0, 'medium', '{followup,sequences,sales}', 'Automatiza seguimiento de prospectos', 'Automates prospect follow-up'),
  
  -- Operations Pack
  ('inventory-sync', 'Sincronización de Inventario', 'Inventory Sync', 'operations', 'Inventory Management', 20.0, 'simple', '{inventory,sync,operations}', 'Sincroniza inventario automáticamente', 'Syncs inventory automatically'),
  ('order-processing', 'Procesamiento de Órdenes', 'Order Processing', 'operations', 'Order Management', 35.0, 'medium', '{orders,processing,fulfillment}', 'Procesa órdenes automáticamente', 'Processes orders automatically'),
  ('shipping-labels', 'Etiquetas de Envío', 'Shipping Labels', 'operations', 'Shipping Automation', 15.0, 'simple', '{shipping,labels,logistics}', 'Genera etiquetas de envío', 'Generates shipping labels')
on conflict (workflow_key) do nothing;

-- ============================================================================
-- REFRESH MATERIALIZED VIEWS (INITIAL)
-- ============================================================================

refresh materialized view mv_funnels_daily;
refresh materialized view mv_ttv_cohorts_weekly;  
refresh materialized view mv_adoption_pack;
refresh materialized view mv_nsm_usd;

-- ============================================================================
-- GRANTS & PERMISSIONS
-- ============================================================================

-- Grant usage on analytics tables to authenticated users
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

-- Grant full access to service role (for functions)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Grant refresh materialized view to service role
grant all on mv_funnels_daily to service_role;
grant all on mv_ttv_cohorts_weekly to service_role;
grant all on mv_adoption_pack to service_role;
grant all on mv_nsm_usd to service_role;

-- ============================================================================
-- FUNCTIONS FOR MATERIALIZED VIEW REFRESH
-- ============================================================================

-- Function to refresh all analytics materialized views
create or replace function refresh_analytics_materialized_views()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view mv_funnels_daily;
  refresh materialized view mv_ttv_cohorts_weekly;
  refresh materialized view mv_adoption_pack;
  refresh materialized view mv_nsm_usd;
end;
$$;

-- Grant execute to service role
grant execute on function refresh_analytics_materialized_views() to service_role;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

comment on table funnel_events is 'Eventos de funnel para tracking de conversión y cohorts';
comment on table outcomes is 'Outcomes de negocio que representan valor real generado';
comment on table savings_baseline is 'Baseline de tiempo ahorrado por workflow y tenant';
comment on table templates_metadata is 'Metadatos de templates con estimaciones de tiempo por defecto';
comment on table usage_executions is 'Ejecuciones recolectadas de n8n para cálculo de métricas';
comment on table kpi_rollups_daily is 'Agregaciones diarias de KPIs por tenant';
comment on table kpi_rollups_monthly is 'Agregaciones mensuales de KPIs por tenant';

comment on materialized view mv_funnels_daily is 'Vista materializada de eventos de funnel agregados por día';
comment on materialized view mv_ttv_cohorts_weekly is 'Vista materializada de cohorts TTV semanales';
comment on materialized view mv_adoption_pack is 'Vista materializada de adopción por pack de templates';
comment on materialized view mv_nsm_usd is 'Vista materializada del NSM (ROI) en USD por mes';

comment on function refresh_analytics_materialized_views() is 'Actualiza todas las vistas materializadas de analytics';

-- Migration completed
insert into schema_migrations (version, name) values 
  ('012', 'analytics_reporting_system')
on conflict (version) do nothing;