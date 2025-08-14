-- RP9 Fase 15: MIGRACIONES COMPLETAS PARA EJECUTAR EN SUPABASE SQL EDITOR
-- Copiar y pegar TODO este archivo en el SQL Editor de Supabase
-- =====================================================================

-- ========== MIGRACIÓN 090: ESTRUCTURA BASE I18N ==========

-- Configuración de países/regiones soportadas
create table if not exists country_configs (
  country_code char(2) primary key,
  country_name text not null,
  locale text not null,                    -- es-MX, es-CO, etc.
  currency char(3) not null,               -- MXN, COP, etc.
  timezone text not null,                  -- America/Mexico_City
  currency_symbol text not null default '$',
  tax_mode text not null default 'gross', -- gross|net (B2C vs B2B)
  tax_id_label text,                       -- RFC|RUT|RUC|CUIT|NIT|RNC
  tax_id_required boolean default false,
  vat_rate numeric(5,2) default 0,         -- porcentaje IVA
  phone_code text,                         -- +52, +57, etc.
  date_format text default 'DD/MM/YYYY',
  number_format text default 'es-419',     -- para Intl.NumberFormat
  active boolean default true,
  meta jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Price book por país/plan/periodicidad
create table if not exists price_books (
  id bigserial primary key,
  country_code char(2) not null references country_configs(country_code),
  plan_id text not null,                   -- starter|pro|enterprise|addon_*
  period text not null,                    -- monthly|yearly|one_time
  currency char(3) not null,
  stripe_price_id text not null,           -- price_xxx de Stripe
  list_price numeric(10,2) not null,       -- precio lista
  psychological_price numeric(10,2),       -- precio psicológico (1999, 399000)
  discount_pct numeric(5,2) default 0,     -- descuento anual
  active boolean default true,
  meta jsonb default '{}',
  created_at timestamptz default now(),
  unique(country_code, plan_id, period)
);

-- Configuración por tenant/organización
create table if not exists tenant_settings (
  tenant_id uuid primary key,
  country_code char(2) references country_configs(country_code),
  locale text not null default 'es-419',
  timezone text not null default 'America/Mexico_City',
  preferred_currency char(3) not null default 'MXN',
  business_type text default 'B2C',        -- B2C|B2B
  tax_id text,                             -- RFC, RUT, etc.
  legal_name text,
  billing_address jsonb,
  flags jsonb default '{}',                -- feature flags específicos
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Preferencias por usuario
create table if not exists user_preferences (
  user_id uuid primary key,
  locale text default 'es-419',
  currency_display char(3) default 'LOCAL', -- LOCAL|USD|BOTH
  timezone text,
  theme text default 'system',             -- light|dark|system
  notifications jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Feature flags por país
create table if not exists country_feature_flags (
  country_code char(2) primary key references country_configs(country_code),
  payment_methods jsonb default '["card"]', -- ["card", "oxxo", "pse", "mercadopago"]
  billing_features jsonb default '{}',      -- {"dunning": true, "autopay": true}
  marketplace_features jsonb default '{}',  -- {"local_templates": true, "local_currency": true}
  compliance_features jsonb default '{}',   -- {"tax_withholding": true, "cfdi": true}
  ui_features jsonb default '{}',           -- {"show_tax_breakdown": true}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Feature flags por tenant (override country defaults)
create table if not exists tenant_feature_flags (
  tenant_id uuid primary key,
  payment_methods jsonb,
  billing_features jsonb,
  marketplace_features jsonb,
  compliance_features jsonb,
  ui_features jsonb,
  experimental jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Mensajes i18n gestionados desde la BD
create table if not exists i18n_messages (
  id bigserial primary key,
  locale text not null,
  namespace text not null default 'common', -- common|billing|marketplace|etc
  message_key text not null,
  message_value text not null,
  description text,                          -- para traductores
  variables jsonb default '[]',              -- [{name: "count", type: "number"}]
  context text,                              -- contexto para traductores
  status text default 'active',             -- active|draft|deprecated
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(locale, namespace, message_key)
);

-- Índices para performance
create index if not exists idx_price_books_country_plan on price_books(country_code, plan_id);
create index if not exists idx_price_books_active on price_books(active) where active = true;
create index if not exists idx_i18n_messages_locale_namespace on i18n_messages(locale, namespace);
create index if not exists idx_i18n_messages_active on i18n_messages(status) where status = 'active';
create index if not exists idx_tenant_settings_country on tenant_settings(country_code);

-- RLS (Row Level Security) para multi-tenancy
alter table tenant_settings enable row level security;
alter table tenant_feature_flags enable row level security;
alter table user_preferences enable row level security;

-- Políticas básicas (ajustar según autenticación)
create policy "Tenant settings are viewable by tenant members" on tenant_settings
  for select using (tenant_id = auth.jwt() ->> 'tenant_id');

create policy "User preferences are viewable by user" on user_preferences  
  for select using (user_id = auth.uid());

-- Función helper para obtener configuración de país por locale
create or replace function get_country_config_by_locale(p_locale text)
returns table(
  country_code char(2),
  country_name text,
  currency char(3),
  timezone text,
  tax_mode text,
  tax_id_label text
) language sql stable as $$
  select cc.country_code, cc.country_name, cc.currency, cc.timezone, cc.tax_mode, cc.tax_id_label
  from country_configs cc
  where cc.locale = p_locale and cc.active = true
  limit 1;
$$;

-- Función para obtener price book entry
create or replace function get_price_book_entry(
  p_country_code char(2),
  p_plan_id text,
  p_period text,
  p_currency_preference char(3) default null
) returns table(
  stripe_price_id text,
  currency char(3),
  list_price numeric(10,2),
  psychological_price numeric(10,2),
  discount_pct numeric(5,2)
) language sql stable as $$
  select pb.stripe_price_id, pb.currency, pb.list_price, pb.psychological_price, pb.discount_pct
  from price_books pb
  where pb.country_code = p_country_code
    and pb.plan_id = p_plan_id
    and pb.period = p_period
    and pb.active = true
    and (p_currency_preference is null or pb.currency = p_currency_preference)
  order by 
    case when pb.currency = p_currency_preference then 1 else 2 end,
    pb.created_at desc
  limit 1;
$$;

-- Función para normalizar montos a USD (para analytics)
create or replace function normalize_to_usd(
  amount numeric,
  currency char(3),
  exchange_rate numeric default null
) returns numeric language sql immutable as $$
  select case 
    when currency = 'USD' then amount
    when exchange_rate is not null then amount / exchange_rate
    -- Hardcoded approximate rates para casos donde no hay exchange_rate
    -- En producción esto vendría de una tabla de exchange_rates actualizada
    when currency = 'MXN' then amount / 20.0
    when currency = 'COP' then amount / 4000.0
    when currency = 'CLP' then amount / 800.0
    when currency = 'PEN' then amount / 3.8
    when currency = 'ARS' then amount / 350.0
    when currency = 'DOP' then amount / 58.0
    else amount -- fallback
  end;
$$;

-- ========== MIGRACIÓN 091: DATOS SEMILLA ==========

-- Configuración de países LatAm + fallback US
insert into country_configs (
  country_code, country_name, locale, currency, timezone, currency_symbol,
  tax_mode, tax_id_label, tax_id_required, vat_rate, phone_code,
  date_format, number_format, active, meta
) values 
  -- México
  ('MX', 'México', 'es-MX', 'MXN', 'America/Mexico_City', '$',
   'gross', 'RFC', true, 16.00, '+52',
   'DD/MM/YYYY', 'es-MX', true, '{"cfdi_required": true, "sat_catalog": true}'::jsonb),
   
  -- Colombia  
  ('CO', 'Colombia', 'es-CO', 'COP', 'America/Bogota', '$',
   'gross', 'NIT', true, 19.00, '+57', 
   'DD/MM/YYYY', 'es-CO', true, '{"dian_required": true}'::jsonb),
   
  -- Chile
  ('CL', 'Chile', 'es-CL', 'CLP', 'America/Santiago', '$',
   'net', 'RUT', true, 19.00, '+56',
   'DD-MM-YYYY', 'es-CL', true, '{"sii_required": true}'::jsonb),
   
  -- Perú
  ('PE', 'Perú', 'es-PE', 'PEN', 'America/Lima', 'S/',
   'gross', 'RUC', true, 18.00, '+51',
   'DD/MM/YYYY', 'es-PE', true, '{"sunat_required": true}'::jsonb),
   
  -- Argentina
  ('AR', 'Argentina', 'es-AR', 'ARS', 'America/Argentina/Buenos_Aires', '$',
   'gross', 'CUIT', true, 21.00, '+54',
   'DD/MM/YYYY', 'es-AR', true, '{"afip_required": true, "withholding": true}'::jsonb),
   
  -- República Dominicana
  ('DO', 'República Dominicana', 'es-DO', 'DOP', 'America/Santo_Domingo', '$',
   'gross', 'RNC', false, 18.00, '+1-809',
   'DD/MM/YYYY', 'es-DO', true, '{"dgii_required": false}'::jsonb),
   
  -- Estados Unidos (fallback para USD)
  ('US', 'Estados Unidos', 'en-US', 'USD', 'America/New_York', '$',
   'net', 'SSN', false, 0.00, '+1',
   'MM/DD/YYYY', 'en-US', true, '{"sales_tax_varies": true}'::jsonb)
on conflict (country_code) do nothing;

-- Price books iniciales (precios psicológicos por país)
-- Starter Plan
insert into price_books (
  country_code, plan_id, period, currency, stripe_price_id, 
  list_price, psychological_price, discount_pct, active, meta
) values
  -- México - Starter
  ('MX', 'starter', 'monthly', 'MXN', 'price_mx_starter_monthly', 999.00, 999.00, 0, true, '{}'),
  ('MX', 'starter', 'yearly', 'MXN', 'price_mx_starter_yearly', 7992.00, 7992.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Colombia - Starter  
  ('CO', 'starter', 'monthly', 'COP', 'price_co_starter_monthly', 99000.00, 99000.00, 0, true, '{}'),
  ('CO', 'starter', 'yearly', 'COP', 'price_co_starter_yearly', 799200.00, 799000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Chile - Starter
  ('CL', 'starter', 'monthly', 'CLP', 'price_cl_starter_monthly', 19900.00, 19900.00, 0, true, '{}'),
  ('CL', 'starter', 'yearly', 'CLP', 'price_cl_starter_yearly', 159200.00, 159000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Perú - Starter
  ('PE', 'starter', 'monthly', 'PEN', 'price_pe_starter_monthly', 99.00, 99.00, 0, true, '{}'),
  ('PE', 'starter', 'yearly', 'PEN', 'price_pe_starter_yearly', 792.00, 790.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Argentina - Starter
  ('AR', 'starter', 'monthly', 'ARS', 'price_ar_starter_monthly', 9990.00, 9990.00, 0, true, '{}'),
  ('AR', 'starter', 'yearly', 'ARS', 'price_ar_starter_yearly', 79920.00, 79900.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- República Dominicana - Starter
  ('DO', 'starter', 'monthly', 'DOP', 'price_do_starter_monthly', 1499.00, 1499.00, 0, true, '{}'),
  ('DO', 'starter', 'yearly', 'DOP', 'price_do_starter_yearly', 11992.00, 11990.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Estados Unidos - Starter (USD)
  ('US', 'starter', 'monthly', 'USD', 'price_us_starter_monthly', 49.00, 49.00, 0, true, '{}'),
  ('US', 'starter', 'yearly', 'USD', 'price_us_starter_yearly', 392.00, 390.00, 33.33, true, '{"savings": "4 months free"}')

on conflict (country_code, plan_id, period) do nothing;

-- Pro Plan
insert into price_books (
  country_code, plan_id, period, currency, stripe_price_id,
  list_price, psychological_price, discount_pct, active, meta  
) values
  -- México - Pro
  ('MX', 'pro', 'monthly', 'MXN', 'price_mx_pro_monthly', 1999.00, 1999.00, 0, true, '{}'),
  ('MX', 'pro', 'yearly', 'MXN', 'price_mx_pro_yearly', 15992.00, 15990.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Colombia - Pro
  ('CO', 'pro', 'monthly', 'COP', 'price_co_pro_monthly', 199000.00, 199000.00, 0, true, '{}'),
  ('CO', 'pro', 'yearly', 'COP', 'price_co_pro_yearly', 1592000.00, 1590000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Chile - Pro  
  ('CL', 'pro', 'monthly', 'CLP', 'price_cl_pro_monthly', 39900.00, 39900.00, 0, true, '{}'),
  ('CL', 'pro', 'yearly', 'CLP', 'price_cl_pro_yearly', 319200.00, 319000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Perú - Pro
  ('PE', 'pro', 'monthly', 'PEN', 'price_pe_pro_monthly', 199.00, 199.00, 0, true, '{}'),
  ('PE', 'pro', 'yearly', 'PEN', 'price_pe_pro_yearly', 1592.00, 1590.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Argentina - Pro
  ('AR', 'pro', 'monthly', 'ARS', 'price_ar_pro_monthly', 19990.00, 19990.00, 0, true, '{}'),  
  ('AR', 'pro', 'yearly', 'ARS', 'price_ar_pro_yearly', 159920.00, 159900.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- República Dominicana - Pro
  ('DO', 'pro', 'monthly', 'DOP', 'price_do_pro_monthly', 2999.00, 2999.00, 0, true, '{}'),
  ('DO', 'pro', 'yearly', 'DOP', 'price_do_pro_yearly', 23992.00, 23990.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Estados Unidos - Pro (USD)
  ('US', 'pro', 'monthly', 'USD', 'price_us_pro_monthly', 99.00, 99.00, 0, true, '{}'),
  ('US', 'pro', 'yearly', 'USD', 'price_us_pro_yearly', 792.00, 790.00, 33.33, true, '{"savings": "4 months free"}')
  
on conflict (country_code, plan_id, period) do nothing;

-- Feature flags por país (configuración inicial)
insert into country_feature_flags (
  country_code, payment_methods, billing_features, marketplace_features, 
  compliance_features, ui_features
) values 
  ('MX', '["card", "oxxo"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb, 
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": false, "cfdi": true, "factura_global": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('CO', '["card", "pse", "bancolombia"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb, 
   '{"tax_withholding": true, "factura_electronica": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('CL', '["card", "khipu"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": false, "boleta_electronica": true}'::jsonb, 
   '{"show_tax_breakdown": false, "tax_inclusive_pricing": false}'::jsonb),
   
  ('PE', '["card", "pagoefectivo"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": true, "factura_electronica": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('AR', '["card", "mercadopago"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": true, "factura_electronica": true, "afip_integration": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('DO', '["card"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": false, "factura_electronica": false}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('US', '["card", "ach"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": false, "local_currency": false}'::jsonb,
   '{"tax_withholding": false, "1099": false}'::jsonb,
   '{"show_tax_breakdown": false, "tax_inclusive_pricing": false}'::jsonb)
   
on conflict (country_code) do nothing;

-- Mensajes i18n básicos que no están en archivos JSON
insert into i18n_messages (locale, namespace, message_key, message_value, description, context) values
  -- Mensajes de billing específicos por país
  ('es-MX', 'billing', 'tax_id_label', 'RFC', 'Etiqueta para el campo de identificación fiscal mexicano', 'billing_form'),
  ('es-CO', 'billing', 'tax_id_label', 'NIT', 'Etiqueta para el campo de identificación fiscal colombiano', 'billing_form'), 
  ('es-CL', 'billing', 'tax_id_label', 'RUT', 'Etiqueta para el campo de identificación fiscal chileno', 'billing_form'),
  ('es-PE', 'billing', 'tax_id_label', 'RUC', 'Etiqueta para el campo de identificación fiscal peruano', 'billing_form'),
  ('es-AR', 'billing', 'tax_id_label', 'CUIT', 'Etiqueta para el campo de identificación fiscal argentino', 'billing_form'),
  ('es-DO', 'billing', 'tax_id_label', 'RNC', 'Etiqueta para el campo de identificación fiscal dominicano', 'billing_form'),
  
  -- Mensajes de moneda
  ('es-MX', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-CO', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-CL', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-PE', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-AR', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-DO', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  
  ('en-US', 'currency', 'toggle_local', 'View in local currency', 'Button to toggle to local currency view', 'pricing')
  
on conflict (locale, namespace, message_key) do nothing;

-- ========== MIGRACIÓN 092: BILLING EVENTS & TAX RULES ==========

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