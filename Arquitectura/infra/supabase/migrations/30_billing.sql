-- RP9 • Fase 8 • Billing & Finance (Stripe)
-- Planes, suscripciones, uso metered, add-ons y eventos de billing

create table if not exists plans (
  key text primary key,    -- starter | pro | enterprise
  name text not null,
  stripe_price_id text,
  stripe_price_id_yearly text,
  limits jsonb not null,   -- {"executions":1000,"editors":2,...}
  metadata jsonb default '{}'
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user uuid,
  country text,
  plan text references plans(key),
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- Uso por ejecución (metered)
create table if not exists usage_executions (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  execution_id text unique,
  workflow_id text,
  status text,
  started_at timestamptz,
  stopped_at timestamptz,
  duration_ms bigint,
  created_at timestamptz default now()
);
create index on usage_executions (tenant_id, created_at desc);

-- Paquetes de ejecuciones (add-ons puntuales)
create table if not exists execution_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  pack_size int not null,        -- 10000 | 50000 | 100000
  stripe_invoice_id text,
  purchased_at timestamptz default now(),
  consumed int not null default 0
);

-- Eventos de billing (invoices, pagos, fallos, dunning)
create table if not exists billing_events (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  type text not null,            -- invoice.paid | invoice.payment_failed | dunning.retry | enforcement.warn80 | enforcement.block
  ref text,                      -- stripe id, etc.
  payload jsonb,
  created_at timestamptz default now()
);
create index on billing_events (tenant_id, created_at desc);

-- Vistas simples de consumo
create view v_usage_daily as
select tenant_id, date_trunc('day', created_at) as d,
       count(*) filter (where status='success') as exec_ok,
       count(*) filter (where status='error') as exec_err,
       sum(duration_ms) as dur_ms
from usage_executions
group by 1,2;
