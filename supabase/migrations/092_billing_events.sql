-- Billing events tracking table for analytics and audit
create table if not exists billing_events (
  id bigserial primary key,
  event_type text not null,
  tenant_id uuid,
  user_id uuid,
  country char(2),
  plan_id text,
  period text,
  currency char(3),
  amount numeric(10,2),
  stripe_session_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'pending',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Add indexes for performance
create index if not exists idx_billing_events_tenant on billing_events(tenant_id);
create index if not exists idx_billing_events_type on billing_events(event_type);
create index if not exists idx_billing_events_country on billing_events(country);
create index if not exists idx_billing_events_created on billing_events(created_at);
create index if not exists idx_billing_events_stripe_session on billing_events(stripe_session_id);

-- Update tax_rules table structure (missing from main migration)
create table if not exists tax_rules (
  country char(2) primary key,
  mode text not null,              -- gross|net
  tax_id_label text,               -- RFC|RUT|RUC|CUIT|NIT|RNC
  required boolean default false,
  vat numeric(5,2),                -- VAT/IVA rate
  withholding_rate numeric(5,2),   -- Withholding tax rate
  meta jsonb default '{}'
);

-- Insert tax rules for supported countries
insert into tax_rules (country, mode, tax_id_label, required, vat, withholding_rate, meta) values
  ('MX', 'gross', 'RFC', true, 16.00, 0.00, '{"cfdi_required": true, "withholding_applicable": false}'),
  ('CO', 'gross', 'NIT', true, 19.00, 11.00, '{"reteica": true, "reteiva": true}'),
  ('CL', 'net', 'RUT', true, 19.00, 0.00, '{"sii_required": true}'),
  ('PE', 'gross', 'RUC', true, 18.00, 3.00, '{"withholding_rent": true}'),
  ('AR', 'gross', 'CUIT', true, 21.00, 2.00, '{"afip_required": true, "withholding_various": true}'),
  ('DO', 'gross', 'RNC', false, 18.00, 10.00, '{"dgii_required": false}'),
  ('US', 'net', 'EIN', false, 0.00, 0.00, '{"sales_tax_varies": true}')
on conflict (country) do update set
  mode = excluded.mode,
  tax_id_label = excluded.tax_id_label,
  required = excluded.required,
  vat = excluded.vat,
  withholding_rate = excluded.withholding_rate,
  meta = excluded.meta;

-- Create function to log billing events
create or replace function log_billing_event(
  p_event_type text,
  p_tenant_id uuid default null,
  p_user_id uuid default null,
  p_country char(2) default null,
  p_plan_id text default null,
  p_period text default null,
  p_currency char(3) default null,
  p_amount numeric default null,
  p_stripe_session_id text default null,
  p_metadata jsonb default '{}'
) returns uuid language plpgsql as $$
declare
  event_id uuid;
begin
  insert into billing_events (
    event_type, tenant_id, user_id, country, plan_id, period,
    currency, amount, stripe_session_id, metadata
  ) values (
    p_event_type, p_tenant_id, p_user_id, p_country, p_plan_id, p_period,
    p_currency, p_amount, p_stripe_session_id, p_metadata
  ) returning id into event_id;
  
  return event_id;
end;
$$;