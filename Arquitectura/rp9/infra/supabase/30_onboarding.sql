-- 30_onboarding.sql — Onboarding & TTV
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
  created_at timestamptz default now()
);
create table if not exists country_template_order (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  codes text[] not null,
  created_at timestamptz default now()
);
create unique index if not exists uq_country_order on country_template_order(country);
create table if not exists onboarding_tasks (
  key text primary key,
  title text not null,
  description text,
  critical boolean default false,
  vertical text default null,
  sort int default 0
);
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
create table if not exists activation_events (
  id bigserial primary key,
  tenant_id uuid not null,
  type text not null,
  workflow_id text,
  occurred_at timestamptz not null default now(),
  meta jsonb default '{}'
);
create index if not exists idx_activation_tenant on activation_events(tenant_id, occurred_at desc);
create table if not exists health_snapshots (
  id bigserial primary key,
  tenant_id uuid not null,
  score numeric not null,
  breakdown jsonb not null,
  created_at timestamptz default now()
);
alter table template_catalog enable row level security;
alter table country_template_order enable row level security;
alter table onboarding_tasks enable row level security;
alter table onboarding_progress enable row level security;
alter table activation_events enable row level security;
alter table health_snapshots enable row level security;
create policy tc_read_all on template_catalog for select using (true);
create policy cto_read_all on country_template_order for select using (true);
-- Implementar tenant_check(tenant_id uuid) para el resto (select/insert/update) según tu auth.
