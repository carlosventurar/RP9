-- RP9 • Fase 8 • Billing & Finance (Stripe)
-- Planes, suscripciones, uso metered, add-ons y eventos de billing

-- Create plans table only if it doesn't exist (check for existing from phase1)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'plans') THEN
    CREATE TABLE plans (
      key text primary key,    -- starter | pro | enterprise
      name text not null,
      stripe_price_id text,
      stripe_price_id_yearly text,
      limits jsonb not null,   -- {"executions_per_month":1000,"workflows_max":2,...}
      metadata jsonb default '{}'
    );
    
    -- Insert default plans
    INSERT INTO plans (key, name, stripe_price_id, limits) VALUES 
      ('starter', 'Starter', null, '{"executions_per_month": 1000, "workflows_max": 10, "storage_mb": 500}'),
      ('pro', 'Pro', null, '{"executions_per_month": 10000, "workflows_max": 100, "storage_mb": 2048}'),
      ('enterprise', 'Enterprise', null, '{"executions_per_month": -1, "workflows_max": -1, "storage_mb": 10240}');
  END IF;
END $$;

-- Extend subscriptions table with additional fields if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'current_period_start') THEN
    ALTER TABLE subscriptions ADD COLUMN current_period_start timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'trial_end') THEN
    ALTER TABLE subscriptions ADD COLUMN trial_end timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'metadata') THEN
    ALTER TABLE subscriptions ADD COLUMN metadata jsonb default '{}';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'updated_at') THEN
    ALTER TABLE subscriptions ADD COLUMN updated_at timestamptz default now();
  END IF;
END $$;

-- Extend usage_executions table with additional fields if not exists
DO $$
BEGIN
  -- Add missing columns to existing usage_executions table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_executions') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'usage_executions' AND column_name = 'workflow_name') THEN
      ALTER TABLE usage_executions ADD COLUMN workflow_name text;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'usage_executions' AND column_name = 'node_count') THEN
      ALTER TABLE usage_executions ADD COLUMN node_count integer default 1;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'usage_executions' AND column_name = 'error_message') THEN
      ALTER TABLE usage_executions ADD COLUMN error_message text;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'usage_executions' AND column_name = 'metadata') THEN
      ALTER TABLE usage_executions ADD COLUMN metadata jsonb default '{}';
    END IF;
  END IF;
END $$;

-- Paquetes de ejecuciones (add-ons puntuales)
create table if not exists execution_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  pack_size int not null,        -- 10000 | 50000 | 100000
  price_cents int not null,      -- precio pagado en centavos
  stripe_invoice_id text,
  purchased_at timestamptz default now(),
  consumed int not null default 0,
  expires_at timestamptz         -- opcional: paquetes que expiran
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

-- Dunning management table
create table if not exists dunning_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  stripe_invoice_id text not null,
  attempt_number int not null default 1,
  status text not null default 'pending', -- pending | sent | failed | completed
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  method text default 'email', -- email | whatsapp | sms
  response jsonb default '{}',
  created_at timestamptz default now()
);

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_usage_executions_tenant_created') THEN
    CREATE INDEX idx_usage_executions_tenant_created ON usage_executions (tenant_id, created_at desc);
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_billing_events_tenant_created') THEN
    CREATE INDEX idx_billing_events_tenant_created ON billing_events (tenant_id, created_at desc);
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_billing_events_type') THEN
    CREATE INDEX idx_billing_events_type ON billing_events (type, created_at desc);
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_dunning_attempts_tenant') THEN
    CREATE INDEX idx_dunning_attempts_tenant ON dunning_attempts (tenant_id, created_at desc);
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_dunning_attempts_scheduled') THEN
    CREATE INDEX idx_dunning_attempts_scheduled ON dunning_attempts (scheduled_for) WHERE status = 'pending';
  END IF;
END $$;

-- Vistas mejoradas de uso y facturación
CREATE OR REPLACE VIEW v_usage_daily AS
SELECT 
  tenant_id, 
  date_trunc('day', created_at) as day,
  count(*) filter (where status='success') as executions_success,
  count(*) filter (where status='error') as executions_error,
  count(*) as total_executions,
  avg(duration_ms) as avg_duration_ms,
  sum(duration_ms) as total_duration_ms
FROM usage_executions
GROUP BY tenant_id, date_trunc('day', created_at);

CREATE OR REPLACE VIEW v_usage_monthly AS
SELECT 
  tenant_id,
  date_trunc('month', created_at) as month,
  count(*) filter (where status='success') as executions_success,
  count(*) filter (where status='error') as executions_error,
  count(*) as total_executions,
  avg(duration_ms) as avg_duration_ms
FROM usage_executions
GROUP BY tenant_id, date_trunc('month', created_at);

CREATE OR REPLACE VIEW v_tenant_current_usage AS
WITH current_month AS (
  SELECT date_trunc('month', NOW()) as month_start
),
tenant_usage AS (
  SELECT 
    u.tenant_id,
    count(*) filter (where u.status='success') as executions_this_month,
    count(*) as total_executions_this_month
  FROM usage_executions u, current_month cm
  WHERE u.created_at >= cm.month_start
  GROUP BY u.tenant_id
),
tenant_limits AS (
  SELECT 
    t.id as tenant_id,
    t.plan,
    p.limits,
    (p.limits->>'executions_per_month')::int as execution_limit
  FROM tenants t
  JOIN plans p ON t.plan = p.key
)
SELECT 
  tl.tenant_id,
  tl.plan,
  tl.execution_limit,
  COALESCE(tu.executions_this_month, 0) as current_usage,
  CASE 
    WHEN tl.execution_limit = -1 THEN 0
    ELSE ROUND((COALESCE(tu.executions_this_month, 0)::float / tl.execution_limit::float) * 100, 2)
  END as usage_percentage,
  CASE 
    WHEN tl.execution_limit = -1 THEN false
    ELSE COALESCE(tu.executions_this_month, 0) >= tl.execution_limit
  END as over_limit
FROM tenant_limits tl
LEFT JOIN tenant_usage tu ON tl.tenant_id = tu.tenant_id;

-- RLS Policies (if RLS is enabled)
-- Enable RLS on billing tables
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_attempts ENABLE ROW LEVEL SECURITY;

-- Only allow service role access to billing tables
CREATE POLICY "Service role can access billing_events" ON billing_events
  FOR ALL USING (auth.role() = 'service_role');
  
CREATE POLICY "Service role can access execution_packs" ON execution_packs
  FOR ALL USING (auth.role() = 'service_role');
  
CREATE POLICY "Service role can access dunning_attempts" ON dunning_attempts
  FOR ALL USING (auth.role() = 'service_role');
