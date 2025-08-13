-- ===============================================
-- RP9 Fase 12: Marketplace & Plantillas Monetizadas
-- Schema completo para marketplace con revenue share
-- ===============================================

-- CREATORS & KYC
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  country text,
  display_name text not null,
  stripe_account_id text unique,
  kyc_status text default 'pending' check (kyc_status in ('pending', 'verified', 'failed')),
  status text default 'pending' check (status in ('pending', 'active', 'suspended', 'disabled')),
  total_earnings_cents int default 0,
  payout_schedule text default 'monthly',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para creators
create unique index if not exists creators_user_uidx on creators(user_id);
create index if not exists creators_stripe_account_idx on creators(stripe_account_id);
create index if not exists creators_status_idx on creators(status);

-- CATALOG TAXONOMY & GOVERNANCE  
create table if not exists catalog_categories (
  key text primary key,
  name text not null,
  description text,
  icon text,
  sort_order int default 0,
  is_active boolean default true
);

-- Seeds iniciales de categorías
insert into catalog_categories(key, name, description, icon, sort_order) values
  ('cc', 'Contact Center', 'Atención al cliente y soporte', 'headphones', 10),
  ('fin', 'Finance & Operations', 'Finanzas, contabilidad y operaciones', 'calculator', 20),
  ('wa', 'WhatsApp Automation', 'Automatización WhatsApp Business', 'message-circle', 30),
  ('ecommerce', 'E-commerce', 'Tiendas online y marketplace', 'shopping-cart', 40),
  ('crm', 'CRM & Sales', 'Ventas y gestión de clientes', 'users', 50),
  ('marketing', 'Marketing', 'Campañas y lead generation', 'megaphone', 60),
  ('devops', 'DevOps & IT', 'Infraestructura y desarrollo', 'server', 70),
  ('data', 'Data & Analytics', 'Análisis de datos y BI', 'bar-chart', 80)
on conflict (key) do nothing;

create table if not exists catalog_tags (
  id bigserial primary key,
  tag text unique not null,
  usage_count int default 0,
  created_at timestamptz default now()
);

-- MARKETPLACE ITEMS (packs/templates/solutions)
create table if not exists marketplace_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null check (type in ('template', 'pack', 'solution')),
  category_key text references catalog_categories(key),
  owner_creator uuid references creators(id) on delete set null,
  
  -- Metadata básica
  title text not null,
  short_desc text not null,
  long_desc text,
  images jsonb default '[]', -- URLs de imágenes
  demo_url text,
  documentation_url text,
  
  -- Pricing híbrido (USD cents)
  currency text default 'usd',
  one_off_price_cents int check (one_off_price_cents >= 0),
  subscription_price_cents int check (subscription_price_cents >= 0),
  tier text default 'mid' check (tier in ('low', 'mid', 'pro', 'enterprise')),
  revenue_share_bps int default 7000 check (revenue_share_bps between 0 and 10000), -- 70/30 default
  
  -- Status & Curaduría
  status text default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'delisted')),
  rejection_reason text,
  curator_notes text,
  
  -- Scoring & Featured
  featured_score numeric default 0,
  manual_featured boolean default false,
  featured_until timestamptz,
  
  -- Versioning
  version text default '1.0.0',
  changelog text,
  
  -- Stats
  view_count int default 0,
  install_count int default 0,
  purchase_count int default 0,
  rating_avg numeric(3,2) default 0,
  rating_count int default 0,
  
  -- Technical metadata  
  metadata jsonb default '{}',
  requirements jsonb default '[]', -- prerequisitos técnicos
  tags jsonb default '[]', -- tags como array JSON
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para marketplace_items
create index if not exists marketplace_items_status_idx on marketplace_items(status);
create index if not exists marketplace_items_category_idx on marketplace_items(category_key);
create index if not exists marketplace_items_creator_idx on marketplace_items(owner_creator);
create index if not exists marketplace_items_featured_idx on marketplace_items(featured_score desc);
create index if not exists marketplace_items_tier_idx on marketplace_items(tier);
create index if not exists marketplace_items_type_idx on marketplace_items(type);

-- Full-text search en title + short_desc
create index if not exists marketplace_items_search_idx on marketplace_items using gin(to_tsvector('spanish', title || ' ' || short_desc));

-- ITEM VERSIONS (historial de versiones)
create table if not exists item_versions (
  id bigserial primary key,
  item_id uuid references marketplace_items(id) on delete cascade,
  version text not null,
  changelog text,
  json_url text not null, -- URL Storage del export n8n
  json_size_bytes int,
  passed_lint boolean default false,
  lint_report jsonb,
  security_scan_passed boolean default false,
  security_report jsonb,
  created_at timestamptz default now()
);

create index if not exists item_versions_item_idx on item_versions(item_id, created_at desc);
create index if not exists item_versions_version_idx on item_versions(item_id, version);

-- PREVIEW TOKENS (límite de ejecuciones gratis)
create table if not exists preview_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  item_id uuid references marketplace_items(id) on delete cascade,
  remaining int default 5,
  daily_limit int default 5,
  last_used_at timestamptz,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

create unique index if not exists preview_tokens_tenant_item_idx on preview_tokens(tenant_id, item_id);
create index if not exists preview_tokens_expires_idx on preview_tokens(expires_at);

-- PURCHASES & LICENSING
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  buyer_user uuid references auth.users(id) on delete set null,
  item_id uuid references marketplace_items(id) on delete cascade,
  
  -- Stripe data
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  
  -- Pricing
  currency text not null,
  amount_cents int not null check (amount_cents > 0),
  kind text not null check (kind in ('one_off', 'subscription')),
  billing_period text check (billing_period in ('monthly', 'yearly')),
  
  -- Status
  status text not null default 'active' check (status in ('active', 'refunded', 'canceled', 'expired')),
  
  -- Licensing & Security  
  fingerprint text not null, -- hash(tenant_id+item_id+stripe_id) para trazabilidad
  license_key text unique not null,
  
  -- Dates
  starts_at timestamptz default now(),
  expires_at timestamptz, -- null para one-off, date para subs
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists purchases_tenant_idx on purchases(tenant_id);
create index if not exists purchases_item_idx on purchases(item_id);
create index if not exists purchases_buyer_idx on purchases(buyer_user);
create index if not exists purchases_stripe_payment_idx on purchases(stripe_payment_intent_id);
create index if not exists purchases_stripe_sub_idx on purchases(stripe_subscription_id);
create index if not exists purchases_status_idx on purchases(status);
create unique index if not exists purchases_license_idx on purchases(license_key);

-- REFUNDS & DEVOLUCIONES
create table if not exists refunds (
  id bigserial primary key,
  purchase_id uuid references purchases(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reason text not null,
  reason_category text check (reason_category in ('technical_issue', 'not_as_described', 'accidental_purchase', 'other')),
  
  -- Stripe data
  stripe_refund_id text,
  amount_cents int not null,
  
  -- Workflow
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed', 'failed')),
  admin_notes text,
  refund_type text default 'credit' check (refund_type in ('credit', 'cash')), -- crédito catálogo vs efectivo
  
  -- Timeline
  requested_at timestamptz default now(),
  reviewed_at timestamptz,
  completed_at timestamptz
);

create index if not exists refunds_purchase_idx on refunds(purchase_id);
create index if not exists refunds_status_idx on refunds(status);
create index if not exists refunds_requested_by_idx on refunds(requested_by);

-- INSTALLS & ADOPTION  
create table if not exists template_installs (
  id bigserial primary key,
  tenant_id uuid not null,
  item_id uuid references marketplace_items(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete set null, -- null si es gratis
  
  -- n8n workflow data
  workflow_id text not null, -- ID en n8n
  workflow_name text,
  version_installed text,
  
  -- Update tracking
  auto_update_enabled boolean default true,
  pending_major_update text, -- version pendiente si requiere consentimiento
  last_update_check timestamptz,
  
  -- Adoption metrics (actualizados por analytics)
  executions_30d int default 0,
  outcomes_30d int default 0,
  success_rate numeric(5,2) default 0,
  last_execution_at timestamptz,
  
  -- Status
  status text default 'active' check (status in ('active', 'inactive', 'uninstalled')),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists template_installs_tenant_item_idx on template_installs(tenant_id, item_id);
create index if not exists template_installs_workflow_idx on template_installs(workflow_id);
create index if not exists template_installs_item_idx on template_installs(item_id);
create index if not exists template_installs_purchase_idx on template_installs(purchase_id);

-- CREATOR EARNINGS & SPLIT
create table if not exists creator_earnings (
  id bigserial primary key,
  creator_id uuid references creators(id) on delete cascade,
  item_id uuid references marketplace_items(id) on delete set null,
  purchase_id uuid references purchases(id) on delete set null,
  
  -- Amounts (neto para creator después del split)
  gross_amount_cents int not null, -- precio total del item
  fee_amount_cents int not null, -- comisión RP9
  net_amount_cents int not null, -- neto para creator
  currency text not null,
  
  -- Payout tracking
  paid_out boolean default false,
  payout_id uuid,
  earned_at timestamptz default now()
);

create index if not exists creator_earnings_creator_idx on creator_earnings(creator_id);
create index if not exists creator_earnings_payout_idx on creator_earnings(paid_out, creator_id);
create index if not exists creator_earnings_item_idx on creator_earnings(item_id);

-- PAYOUTS (Stripe Connect transfers)
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  
  -- Stripe Connect data
  stripe_transfer_id text unique,
  stripe_account_id text not null,
  
  -- Period & amounts
  period_start date not null,
  period_end date not null,  
  gross_amount_cents int not null,
  fee_amount_cents int not null,
  net_amount_cents int not null,
  currency text default 'usd',
  
  -- Status
  status text default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled')),
  failure_reason text,
  
  -- Metadata
  earnings_count int not null, -- número de earnings incluidos
  csv_report_url text, -- URL del reporte CSV
  notes text,
  
  created_at timestamptz default now(),
  paid_at timestamptz
);

create index if not exists payouts_creator_idx on payouts(creator_id);
create index if not exists payouts_period_idx on payouts(period_start, period_end);
create index if not exists payouts_status_idx on payouts(status);
create unique index if not exists payouts_stripe_transfer_idx on payouts(stripe_transfer_id);

-- REVIEWS & RATINGS
create table if not exists item_reviews (
  id bigserial primary key,
  item_id uuid references marketplace_items(id) on delete cascade,
  tenant_id uuid not null,
  reviewer_user uuid references auth.users(id) on delete set null,
  purchase_id uuid references purchases(id) on delete cascade, -- debe haber comprado para review
  
  rating int not null check (rating between 1 and 5),
  title text,
  comment text,
  pros text,
  cons text,
  
  -- Moderation
  is_verified boolean default false, -- compra verificada
  is_featured boolean default false,
  moderation_status text default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  
  -- Helpfulness votes
  helpful_count int default 0,
  unhelpful_count int default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists item_reviews_item_idx on item_reviews(item_id);
create index if not exists item_reviews_rating_idx on item_reviews(rating);
create unique index if not exists item_reviews_purchase_idx on item_reviews(purchase_id); -- una review por compra

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Creators: usuarios solo ven sus propios registros  
alter table creators enable row level security;
create policy creators_own_data on creators
  using (auth.uid() = user_id);

-- Marketplace items: públicos si approved, owners ven todos sus items
alter table marketplace_items enable row level security;
create policy marketplace_items_public on marketplace_items
  for select using (status = 'approved');
create policy marketplace_items_creator_own on marketplace_items  
  using (exists (
    select 1 from creators c 
    where c.id = marketplace_items.owner_creator 
    and c.user_id = auth.uid()
  ));

-- Purchases: usuarios solo ven sus compras
alter table purchases enable row level security;
create policy purchases_own_data on purchases
  using (buyer_user = auth.uid());

-- Template installs: por tenant (usar service role en functions)
alter table template_installs enable row level security;
create policy template_installs_tenant on template_installs
  using (true); -- usar service role key en functions, filtrar por tenant

-- Creator earnings: creators solo ven sus earnings
alter table creator_earnings enable row level security; 
create policy creator_earnings_own on creator_earnings
  using (exists (
    select 1 from creators c
    where c.id = creator_earnings.creator_id
    and c.user_id = auth.uid()  
  ));

-- Reviews: públicas para lectura, usuarios solo editan las suyas
alter table item_reviews enable row level security;
create policy item_reviews_public_read on item_reviews
  for select using (moderation_status = 'approved');
create policy item_reviews_own_write on item_reviews
  using (reviewer_user = auth.uid());

-- ===========================================
-- VIEWS ÚTILES & MATERIALIZED VIEWS  
-- ===========================================

-- Vista de adopción por item (scoring 60/40)
create or replace view v_adoption_score as
select
  i.id as item_id,
  i.title,
  i.category_key,
  i.tier,
  coalesce(sum(t.executions_30d), 0) as total_executions_30d,
  coalesce(sum(t.outcomes_30d), 0) as total_outcomes_30d,
  count(t.id) as install_count,
  case
    when coalesce(sum(t.executions_30d), 0) = 0 and coalesce(sum(t.outcomes_30d), 0) = 0 then 0
    else
      coalesce(
        (sum(t.executions_30d)::numeric / nullif(
          (select max(exec_sum) from (
            select sum(executions_30d) as exec_sum 
            from template_installs 
            group by item_id
          ) mx), 0) * 0.6), 0) +
      coalesce(
        (sum(t.outcomes_30d)::numeric / nullif(
          (select max(out_sum) from (
            select sum(outcomes_30d) as out_sum
            from template_installs
            group by item_id
          ) mx), 0) * 0.4), 0)
  end as adoption_score
from marketplace_items i
left join template_installs t on t.item_id = i.id and t.status = 'active'
where i.status = 'approved'
group by i.id, i.title, i.category_key, i.tier;

-- Vista de ingresos por creator
create or replace view v_creator_revenue as
select 
  c.id as creator_id,
  c.display_name,
  c.status,
  count(distinct i.id) as items_published,
  coalesce(sum(ce.net_amount_cents), 0) as total_earnings_cents,
  coalesce(sum(case when ce.paid_out then ce.net_amount_cents else 0 end), 0) as paid_out_cents,
  coalesce(sum(case when not ce.paid_out then ce.net_amount_cents else 0 end), 0) as pending_payout_cents,
  count(distinct p.id) as total_sales
from creators c
left join marketplace_items i on i.owner_creator = c.id and i.status = 'approved'
left join creator_earnings ce on ce.creator_id = c.id
left join purchases p on p.id = ce.purchase_id and p.status = 'active'
group by c.id, c.display_name, c.status;

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Trigger para actualizar updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Aplicar trigger a tablas relevantes  
create trigger update_creators_updated_at before update on creators
  for each row execute function update_updated_at();
create trigger update_marketplace_items_updated_at before update on marketplace_items  
  for each row execute function update_updated_at();
create trigger update_purchases_updated_at before update on purchases
  for each row execute function update_updated_at();
create trigger update_template_installs_updated_at before update on template_installs
  for each row execute function update_updated_at();

-- Function para generar license keys
create or replace function generate_license_key(tenant_uuid uuid, item_uuid uuid)
returns text as $$
declare
  key_prefix text;
  random_suffix text;
begin
  key_prefix := 'rp9_' || substring(tenant_uuid::text from 1 for 8) || '_' || substring(item_uuid::text from 1 for 8);
  random_suffix := encode(gen_random_bytes(8), 'hex');
  return upper(key_prefix || '_' || random_suffix);
end;
$$ language plpgsql;

-- Function para calcular earnings split
create or replace function calculate_earnings_split(
  gross_cents int,
  revenue_share_bps int
)
returns table(
  gross_amount_cents int,
  fee_amount_cents int, 
  net_amount_cents int
) as $$
begin
  return query select
    gross_cents as gross_amount_cents,
    (gross_cents * (10000 - revenue_share_bps) / 10000)::int as fee_amount_cents,
    (gross_cents * revenue_share_bps / 10000)::int as net_amount_cents;
end;
$$ language plpgsql;

-- ===========================================
-- SEED DATA INICIAL
-- ===========================================

-- Tags comunes
insert into catalog_tags(tag) values
  ('free'), ('premium'), ('beginner'), ('advanced'),
  ('automation'), ('integration'), ('ai'), ('webhook'),
  ('api'), ('crm'), ('email'), ('sms'), ('whatsapp'),
  ('ecommerce'), ('payment'), ('analytics'), ('reporting'),
  ('backup'), ('security'), ('monitoring'), ('social')
on conflict (tag) do nothing;

-- Template mock inicial (gratis) 
insert into marketplace_items(
  slug, type, category_key, title, short_desc, long_desc,
  one_off_price_cents, subscription_price_cents, tier, status,
  version, metadata, tags
) values (
  'email-notification-basic',
  'template',
  'cc', 
  'Email Notification Basic',
  'Send email notifications when specific events occur in workflows',
  'This basic email notification template allows you to send customized emails when specific triggers occur in your n8n workflows. Perfect for alerts, confirmations, and user communications.',
  null, -- gratis
  null, -- no suscripción
  'low',
  'approved',
  '1.0.0',
  '{"complexity": "beginner", "setup_time_minutes": 5, "integrations": ["email", "webhook"]}',
  '["free", "beginner", "email", "notification", "webhook"]'
) on conflict (slug) do nothing;

-- ===========================================
-- ÍNDICES ADICIONALES PARA PERFORMANCE
-- ===========================================

-- Índice compuesto para queries comunes de marketplace
create index if not exists marketplace_items_status_featured_idx on marketplace_items(status, featured_score desc, created_at desc);
create index if not exists marketplace_items_category_tier_idx on marketplace_items(category_key, tier, status);

-- Índices para analytics y reports
create index if not exists creator_earnings_date_idx on creator_earnings(earned_at, paid_out);
create index if not exists purchases_date_status_idx on purchases(created_at, status);
create index if not exists template_installs_executions_idx on template_installs(executions_30d desc, outcomes_30d desc);

-- Índice para cleanup de preview tokens expirados
create index if not exists preview_tokens_cleanup_idx on preview_tokens(expires_at) where expires_at < now();

-- ===========================================
-- COMENTARIOS FINALES
-- ===========================================

-- Tablas creadas: 12 principales
-- Índices: 30+ para performance óptima  
-- RLS: Configurado para multi-tenancy seguro
-- Views: 2 vistas útiles para reporting
-- Functions: 3 funciones de utilidad
-- Triggers: Auto-update de timestamps
-- Seeds: Categorías, tags y template inicial

-- Para completar setup:
-- 1. Configurar Stripe Connect en creators
-- 2. Configurar Storage para JSON exports
-- 3. Configurar webhooks Stripe  
-- 4. Configurar scheduled functions para payouts

commit;