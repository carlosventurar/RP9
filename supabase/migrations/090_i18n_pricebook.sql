-- Agente Virtual IA Fase 15: Internacionalización LatAm-first
-- Migración para soporte completo de i18n, price books, y configuración por país

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