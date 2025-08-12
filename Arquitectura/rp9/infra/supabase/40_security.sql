
-- 40_security.sql — Supabase

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

-- Allowlist de IP por tenant
create table if not exists ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  cidr text not null,
  created_at timestamptz default now()
);
