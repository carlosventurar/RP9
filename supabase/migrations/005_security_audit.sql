-- 005_security_audit.sql — Fase 4: Seguridad, SRE & Compliance

-- Audit log (append-only con hash chain)
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz default now(),
  actor uuid,                    -- auth.uid() si aplica
  tenant_id uuid,
  action text not null,          -- workflow.activate, credential.update, etc.
  resource text,                 -- workflows/123
  meta jsonb default '{}',
  prev_hash text,
  hash text not null
);

alter table audit_log enable row level security;

create policy audit_insert_any on audit_log for insert using (true) with check (true);

create policy audit_read_tenant on audit_log for select
  using (tenant_id in (select id from tenants where owner_user = auth.uid()));

-- Retención / anonimización por tenant
create table if not exists data_retention (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  payload_retention_days int default 60,
  anonymize_after_days int default 0,
  created_at timestamptz default now()
);

alter table data_retention enable row level security;

create policy data_retention_tenant on data_retention for all
  using (tenant_id in (select id from tenants where owner_user = auth.uid()));

-- Allowlist de IP por tenant
create table if not exists ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  cidr text not null,
  created_at timestamptz default now()
);

alter table ip_allowlist enable row level security;

create policy ip_allowlist_tenant on ip_allowlist for all
  using (tenant_id in (select id from tenants where owner_user = auth.uid()));

-- Índices para performance
create index if not exists idx_audit_log_tenant_at on audit_log (tenant_id, at desc);
create index if not exists idx_audit_log_action on audit_log (action);
create index if not exists idx_data_retention_tenant on data_retention (tenant_id);
create index if not exists idx_ip_allowlist_tenant on ip_allowlist (tenant_id);

-- Función para generar hash de audit log
create or replace function generate_audit_hash(
  prev_hash text default null,
  action text default null,
  resource text default null,
  meta jsonb default '{}'::jsonb
) returns text as $$
begin
  return encode(sha256(concat(
    coalesce(prev_hash, ''),
    action,
    resource,
    meta::text
  )::bytea), 'hex');
end;
$$ language plpgsql;

-- Vista para obtener estadísticas de auditoría
create or replace view audit_stats as
select
  tenant_id,
  count(*) as total_events,
  count(distinct action) as unique_actions,
  min(at) as first_event,
  max(at) as last_event
from audit_log
group by tenant_id;

comment on table audit_log is 'Registro de auditoría con hash-chain para integridad';
comment on table data_retention is 'Políticas de retención de datos por tenant';
comment on table ip_allowlist is 'Lista de IPs permitidas por tenant';