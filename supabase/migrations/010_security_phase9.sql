-- Enable required extensions
create extension if not exists pgcrypto;
create extension if not exists uuid-ossp;

-- Tenants & Members (simplified)
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  created_at timestamptz default now()
);

-- API keys (hash stored; not the raw secret)
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  prefix text not null,
  hash bytea not null, -- sha256
  scopes text[] not null default '{}',
  status text not null default 'active', -- active|revoked
  last_used_at timestamptz,
  created_at timestamptz default now(),
  unique(tenant_id, prefix)
);

-- IP allowlist per-tenant
create table if not exists ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cidr text not null, -- e.g. 1.2.3.4/32
  note text,
  created_at timestamptz default now()
);

-- Rate limiting (rolling by minute)
create table if not exists rate_limits (
  key text not null,                -- composite: tenant:apikey or tenant:ip
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Webhook idempotency
create table if not exists webhook_idempotency (
  signature text primary key,
  ts timestamptz not null,
  created_at timestamptz default now()
);

-- Audit logs
create table if not exists audit_logs (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid,
  action text not null,
  resource text,
  resource_id text,
  ip text,
  user_agent text,
  old jsonb,
  new jsonb,
  result text,
  created_at timestamptz default now()
);
create index if not exists idx_audit_tenant_created on audit_logs(tenant_id, created_at desc);

-- Evidence files (with sha256)
create table if not exists evidence_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  country text,
  workflow_id text,
  path text not null,           -- storage key
  sha256 text not null,
  size_bytes bigint,
  legal_hold boolean default false,
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists idx_evidence_tenant_created on evidence_files(tenant_id, created_at desc);

-- Enable RLS
alter table tenants enable row level security;
alter table members enable row level security;
alter table api_keys enable row level security;
alter table ip_allowlist enable row level security;
alter table rate_limits enable row level security;
alter table webhook_idempotency enable row level security;
alter table audit_logs enable row level security;
alter table evidence_files enable row level security;

-- Basic RLS policies (adjust to your auth schema)
-- For demo, allow service role (check via Supabase policies outside) and restrict by tenant_id where applicable.
create policy if not exists tenants_owner_read on tenants for select using (true);
create policy if not exists members_by_tenant on members for all using (true);
create policy if not exists api_keys_by_tenant on api_keys for all using (true);
create policy if not exists ip_allowlist_by_tenant on ip_allowlist for all using (true);
create policy if not exists rate_limits_rw on rate_limits for all using (true);
create policy if not exists webhook_idempotency_rw on webhook_idempotency for all using (true);
create policy if not exists audit_logs_by_tenant on audit_logs for all using (true);
create policy if not exists evidence_files_by_tenant on evidence_files for all using (true);

-- Retention helper view (90 days retention, excluding legal hold)
create or replace view evidence_expired as
  select * from evidence_files
  where created_at < now() - interval '90 days' and legal_hold = false;