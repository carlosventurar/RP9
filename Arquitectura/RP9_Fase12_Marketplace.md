# RP9 — Fase 12: Marketplace & Plantillas monetizadas
**Librería, pricing de templates, revenue share con creators, curaduría y adopción por pack**  
Stack alvo: **GitHub + Netlify + Supabase + Stripe (Billing + Connect) + n8n (Railway)**

---

## 0) Decisiones cerradas (usamos siempre la _recomendación_)
1. **Alcance MVP** → **B**: RP9 + creators curados.
2. **Unidad de catálogo** → **B**: **Pack** (3–5 workflows coherentes).
3. **Modelo de precio** → **C**: híbrido (free/one‑off + add‑on mensual por pack).
4. **Tiers de precio** → **C**: Low/Mid/Pro + Enterprise “call us”.
5. **Monedas** → **B**: USD + MXN/COP/CLP vía Stripe.
6. **Revenue share** → **B**: 70/30 a favor del creator.
7. **Curaduría** → **C**: pre‑aprobación para nuevos; post‑moderación para confiables.
8. **Calidad mínima** → **C**: README + tags + mock data + changelog **+** test de instalación **+** linter.
9. **Seguridad** → **C**: sanitizar + scanner secretos + bloqueo si falla.
10. **Actualizaciones** → **B**: auto‑minors; majors requieren consentimiento.
11. **Preview** → **C**: vista previa + sandbox con N ejecuciones gratis.
12. **Devoluciones** → **C**: reglas 7 días + crédito catálogo; efectivo casos puntuales.
13. **Soporte** → **C**: RP9 1er nivel packs RP9; terceros directo creator.
14. **Featured** → **B**: algoritmo (conv./retención) + curador manual.
15. **Métrica para creators** → **C**: vistas, installs, conversión, refunds, retención 30/60, errores, NPS, ingresos, top cuentas anon.
16. **Protección/licencia** → **C**: EULA + fingerprint buyer + hash por tenant (sin DRM duro).
17. **Ranking por adopción** → **C**: (A 60% ejecuciones, B 40% outcomes).
18. **Bundles/descuentos** → **C**: 10–20% por ≥2 ítems + suscripción de pack.
19. **Payouts** → **C**: mensual con **Stripe Connect**, umbral, retenciones por país (KYC).
20. **Governance** → **C**: taxonomía fija + tags libres + lint metadata CI.

---

## 1) Master Prompt — **Claude Code** (copiar/pegar)
> Eres un **ingeniero full‑stack senior**. En el monorepo `rp9/` implementa el **Marketplace & Plantillas** según las decisiones de arriba. Stack: **Next.js (App Router + Tailwind + shadcn/ui), Netlify Functions (TS), Supabase (Postgres+Storage+RLS), Stripe (Billing + Connect)** y n8n (Railway) para previews de flujo (mock).  
> 
> ### Objetivos de la Fase
> 1) **Catálogo** público (packs/plantillas) con búsqueda, categorías y detalle.  
> 2) **Compra** (Stripe Checkout) para **one‑off** y **suscripciones de pack**; **precios USD + MXN/COP/CLP**.  
> 3) **Preview**: viewer JSON + **sandbox** con N ejecuciones gratis por tenant.  
> 4) **Instalación 1‑click** en el tenant (llamando al BFF → n8n `/api/v1/workflows`).  
> 5) **Actualizaciones**: auto‑minor; major con consentimiento y diff.  
> 6) **Devoluciones**: reglas en 7 días; crédito catálogo por defecto.  
> 7) **Creators**: onboarding a **Stripe Connect**, envío de ítems con **lint** y QA; **payouts mensuales**.  
> 8) **Curaduría**: estado Draft → Pending → Approved/Rejected; featured algorítmico + manual.  
> 9) **Métricas**: vistas, installs, conversión, retención, ingresos, refunds; **ranking adopción 60/40** (uso/outcomes).  
> 10) **Seguridad**: sanitización + scanner de secretos + bloqueo; HMAC en webhooks; RLS multi‑tenant; evidencia hash.
> 
> ### Entregables (código productivo con tipos, zod y tests ligeros)
> - **SQL** en `infra/supabase/migrations/30_marketplace.sql` (tablas abajo).  
> - **Pages**:  
>   - `apps/portal/app/(app)/templates/page.tsx` (grid + filtros + pricing).  
>   - `apps/portal/app/(app)/templates/[slug]/page.tsx` (detalle + preview + instalar/comprar).  
>   - `apps/portal/app/(app)/creator/*` (onboarding, subir ítem, estado QA, métricas).  
>   - `apps/portal/app/(app)/admin/marketplace/*` (curaduría, featured, refunds).  
> - **Functions (Netlify)** en `apps/functions/` (TS):  
>   - `marketplace-list.ts`, `marketplace-detail.ts`  
>   - `marketplace-purchase.ts` (Checkout)  
>   - `marketplace-webhook-stripe.ts` (pagos/refunds/subs/Connect)  
>   - `marketplace-install.ts` (instala en n8n)  
>   - `marketplace-preview.ts` (sandbox N ejecuciones; rate‑limit)  
>   - `creators-onboard.ts` (Stripe Connect account link)  
>   - `payouts-run.ts` (mensual; umbral; retenciones; CSV resumen)  
>   - `catalog-featured.ts` (cron: recalcula score)  
> - **Content/CI**:  
>   - `content/creator-guidelines.md` (requisitos A+B+C)  
>   - `scripts/lint-template.ts` (verifica metadata, placeholders, semver, changelog)  
>   - GitHub Action que corre el linter en PRs de creators.  
> - **.env.example** + `netlify.toml` con _scheduled functions_.  
> - **Métricas**: `metrics.yml` con KPIs base para panel.  
> - **Seeds**: 3 packs (CC‑Starter, Fin‑Pro, WA‑Inbox) con **JSONs** en `public/templates/*.json` (mock).
> 
> ### Reglas clave de negocio
> - **Pricing híbrido**: item `one_off_price` opcional; `subscription_price` opcional (mensual).  
> - **Auto‑updates**: si `version` minor/patch → actualizar; si major → crear “propuesta de actualización” con diff.  
> - **Preview**: por tenant/día: `FREE_PREVIEW_EXECUTIONS` (env) con **HMAC** y **rate‑limit**; mockea n8n.  
> - **Refunds**: si `executions <= N` en 7 días → permitir; caso contrario → **crédito catálogo**.  
> - **Payouts**: mensual, **Stripe Connect** (Standard), umbral USD 50 (config), **fees**: 30% RP9 (config).  
> - **Adopción**: `score = normalize(executions)*0.6 + normalize(outcomes)*0.4` por 30 días.  
> - **Seguridad**: bloquear publicación si linter falla (secrets/tokens/URLs duras).  
> 
> ### Variables de entorno
> ```dotenv
> SUPABASE_URL=...
> SUPABASE_ANON_KEY=...
> SUPABASE_SERVICE_ROLE_KEY=...
> STRIPE_SECRET_KEY=...
> STRIPE_WEBHOOK_SECRET=...
> STRIPE_CONNECT_APP_FEE_BPS=300          # 30% RP9
> STRIPE_PAYOUT_THRESHOLD_USD=50
> FREE_PREVIEW_EXECUTIONS=5
> N8N_BASE_URL=https://primary-production-7f25.up.railway.app
> N8N_API_KEY=__SETME__
> JWT_SECRET=__SETME__
> ```
> 
> ### Aceptación
> - Listado/Detalle operativos; checkout y suscripción con Stripe; compras reflejadas en Supabase.  
> - Preview con límite gratis; instalación 1‑click crea/actualiza workflow en n8n.  
> - Auto‑minors; majors con consentimiento.  
> - Creadores pueden **onboard** a Connect y ver ingresos/retención.  
> - Cron de **payouts** liquida a Connect con CSV y registro.  
> - Curaduría/Admin pueden aprobar, destacar y gestionar refunds.  

---

## 2) SQL — `infra/supabase/migrations/30_marketplace.sql`
```sql
-- CREATOR & KYC
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,         -- user del portal
  country text,
  display_name text,
  stripe_account_id text,        -- Connect
  status text default 'pending', -- pending|active|disabled
  created_at timestamptz default now()
);
create unique index if not exists creators_user_uidx on creators(user_id);

-- TAXONOMY + GOVERNANCE
create table if not exists catalog_categories (
  key text primary key,          -- cc, fin, wa, ops, etc.
  name text not null
);
insert into catalog_categories(key,name) values
  ('cc','Contact Center') on conflict do nothing;

create table if not exists catalog_tags (
  id bigserial primary key,
  tag text unique not null
);

-- ITEMS
create table if not exists marketplace_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null check (type in ('template','pack','solution')),
  category_key text references catalog_categories(key),
  owner_creator uuid references creators(id) on delete set null,
  title text not null,
  short_desc text not null,
  long_desc text,
  images jsonb default '[]',
  -- pricing híbrido
  currency text default 'usd',
  one_off_price_cents int,             -- null si no aplica
  subscription_price_cents int,        -- null si no aplica
  tier text default 'mid',             -- low|mid|pro|enterprise
  revenue_share_bps int default 7000,  -- 70/30
  status text default 'draft',         -- draft|pending|approved|rejected|delisted
  featured_score numeric default 0,
  metadata jsonb default '{}',
  version text default '1.0.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists item_tags (
  item_id uuid references marketplace_items(id) on delete cascade,
  tag_id bigint references catalog_tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

create table if not exists item_versions (
  id bigserial primary key,
  item_id uuid references marketplace_items(id) on delete cascade,
  version text not null,
  changelog text,
  json_url text,          -- Storage key del JSON export n8n
  passed_lint boolean default false,
  created_at timestamptz default now()
);

-- PREVIEW TOKENS (limit free runs)
create table if not exists preview_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  item_id uuid references marketplace_items(id) on delete cascade,
  remaining int default 5,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- PURCHASES & LICENSE
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  buyer_user uuid,
  item_id uuid references marketplace_items(id) on delete cascade,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  currency text not null,
  amount_cents int not null,
  kind text not null check (kind in ('one_off','subscription')),
  status text not null default 'active', -- active|refunded|canceled
  fingerprint text,            -- hash(tenant_id+item_id+stripe_id)
  created_at timestamptz default now()
);
create index on purchases (tenant_id, item_id);

create table if not exists refunds (
  id bigserial primary key,
  purchase_id uuid references purchases(id) on delete cascade,
  reason text,
  stripe_refund_id text,
  status text default 'pending', -- pending|approved|rejected|done
  created_at timestamptz default now()
);

-- INSTALLS & ADOPTION
create table if not exists template_installs (
  id bigserial primary key,
  tenant_id uuid not null,
  item_id uuid references marketplace_items(id) on delete cascade,
  workflow_id text,                 -- id en n8n
  executions_30d int default 0,
  outcomes_30d int default 0,
  last_exec_at timestamptz,
  created_at timestamptz default now(),
  unique (tenant_id, item_id)
);

-- CREATOR EARNINGS & PAYOUTS
create table if not exists creator_earnings (
  id bigserial primary key,
  creator_id uuid references creators(id) on delete cascade,
  item_id uuid references marketplace_items(id) on delete set null,
  purchase_id uuid references purchases(id) on delete set null,
  amount_cents int not null,     -- neto para creator
  currency text not null,
  created_at timestamptz default now(),
  paid_out boolean default false,
  payout_id uuid
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  stripe_transfer_id text,
  period_start date,
  period_end date,
  amount_cents int not null,
  currency text default 'usd',
  status text default 'pending', -- pending|paid|failed
  created_at timestamptz default now()
);

-- RLS (ejemplo mínimo; ajustar políticas por rol)
alter table purchases enable row level security;
create policy purchases_by_tenant on purchases
  using (true); -- en Functions usar service role; UI filtra por tenant.

-- Views útiles
create or replace view v_adoption_score as
select
  i.id as item_id,
  i.title,
  coalesce(sum(t.executions_30d),0) as exec_30d,
  coalesce(sum(t.outcomes_30d),0) as out_30d,
  case
    when coalesce(sum(t.executions_30d),0)=0 and coalesce(sum(t.outcomes_30d),0)=0 then 0
    else
      ( (coalesce(sum(t.executions_30d),0)::numeric) / nullif((select max(exec_30d) from (
            select sum(executions_30d) exec_30d from template_installs group by item_id) m),0) * 0.6 )
      +
      ( (coalesce(sum(t.outcomes_30d),0)::numeric) / nullif((select max(out_30d) from (
            select sum(outcomes_30d) out_30d from template_installs group by item_id) m),0) * 0.4 )
  end as score_30d
from marketplace_items i
left join template_installs t on t.item_id = i.id
group by i.id, i.title;
```

---

## 3) Endpoints / Netlify Functions (especificación)
- `marketplace-list.ts` **GET**: filtros `q`, `category`, `tier` → lista con `featured_score` + `score_30d`.
- `marketplace-detail.ts` **GET** `slug`: detalle + últimas `item_versions` + preview token.
- `marketplace-purchase.ts` **POST**: crea **Stripe Checkout** (one‑off o sub); guarda `purchases` al webhook.
- `marketplace-webhook-stripe.ts` **POST**: maneja `checkout.session.completed`, `invoice.paid/failed`, `charge.refunded`, `customer.subscription.updated` → crea `creator_earnings` con **split 70/30**.
- `marketplace-install.ts` **POST**: valida compra → descarga JSON de `item_versions` y **crea/actualiza** workflow en n8n vía BFF (`/api/workflows`).
- `marketplace-preview.ts` **POST**: decrementa `preview_tokens.remaining` y simula ejecución (mock) → resultado.
- `creators-onboard.ts` **POST**: crea/recupera `stripe_account_id` y genera **account link**.
- `payouts-run.ts` **SCHEDULED**: mensual; agrupa `creator_earnings` no pagados, umbral USD 50, crea **Transfer** en Connect, marca `paid_out` + `payouts`.
- `catalog-featured.ts` **SCHEDULED**: recalcula `featured_score` (conv.*, ret.*) y mezcla con curaduría.

_Esqueletos TS incluidos en el ZIP._

---

## 4) UI (páginas clave)
- `templates/` (grid con filtros: categoría, tier, precio, “featured”). Card: imagen, tags, precio (one‑off/mes), rating, adopción.
- `templates/[slug]` (tabs: Overview · Preview · Changelog · Calidad · Soporte · Licencia). Acciones: **Preview**, **Instalar**, **Comprar**.
- `creator/*` (onboarding Connect, subir versión, estado QA, métricas por ítem).
- `admin/marketplace/*` (curaduría, featured, refunds, visión creators).

---

## 5) Seguridad & Compliance
- Sanitizar export JSON (placeholders en credenciales; no endpoints secretos).  
- Linter de secretos y verificación md5/sha256 del JSON subido a Storage.  
- HMAC en webhooks y rate‑limit per key.  
- Registro de **hash por tenant** (fingerprint de licencia) en `purchases` para trazabilidad.  

---

## 6) Backlog por Sprints
**Sprint MP‑1 (Catálogo & Checkout)**
- [ ] SQL base + seeds categorías/tags.
- [ ] Pages listado/detalle + `marketplace-list/detail`.
- [ ] Checkout one‑off y sub → `marketplace-purchase` + `marketplace-webhook-stripe`.
- [ ] Creator onboarding (Connect).

**Sprint MP‑2 (Preview & Install & Updates)**
- [ ] `marketplace-preview` (limites gratis) y viewer.
- [ ] `marketplace-install` (BFF → n8n).  
- [ ] Auto‑minor; majors con consentimiento + diff.

**Sprint MP‑3 (Curaduría & Seguridad)**
- [ ] Admin: aprobar/rechazar; featured manual.  
- [ ] Linter + CI; bloqueo si falla; sanitización fuerte.

**Sprint MP‑4 (Payouts & Métricas & Bundles)**
- [ ] `payouts-run` mensual (Connect).  
- [ ] KPIs creators + ranking adopción 60/40.  
- [ ] Bundles/descuentos y suscripción de pack.

---

## 7) KPIs (metrics.yml sugerido)
- **GMV Marketplace**, **Ingresos RP9**, **Ingresos creators**, **AOV**, **Refund rate**.  
- **Installs por ítem**, **Adopción 30/60 días**, **Preview→Compra %**, **Tiempo a 1ª instalación**.  
- **Featured uplift** (con vs sin).

---

## 8) Archivos incluidos en el ZIP
- `infra/supabase/migrations/30_marketplace.sql`  
- `apps/functions/*.ts` (esqueletos)  
- `apps/portal/app/(app)/templates/page.tsx` y `[slug]/page.tsx` (stubs)  
- `content/creator-guidelines.md`  
- `netlify.toml` (cron: payouts, featured)  
- `.env.example`  
- `README.md` (instrucciones)  
- `public/templates/cc-001.json` (mock)

# RP9 — Fase 12: Marketplace & Plantillas Monetizadas
**Fecha:** 2025-08-11

Esta fase habilita un **marketplace white‑label** de plantillas/packs con **pricing, revenue share, curaduría y adopción por pack**. Stack: **GitHub + Netlify (Functions) + Supabase + Stripe/Stripe Connect + n8n en Railway** (`https://primary-production-7f25.up.railway.app`).

---

## Decisiones (20/20) — Selección = Recomendación
1) Alcance MVP: **B** (RP9 + creators curados).  
2) Unidad de catálogo: **B** (packs de 3–5 workflows).  
3) Precio por ítem: **C** (free/one‑off + add‑on mensual).  
4) Tiers: **C** (Low/Mid/Pro + Enterprise).  
5) Monedas: **B** (USD + MXN/COP/CLP).  
6) Revenue share: **B** (70/30).  
7) Curaduría: **C** (pre‑aprobación; fast‑track para confiables).  
8) Requisitos calidad: **C** (README+mock+tests+linter).  
9) Seguridad: **C** (sanitizador + secret scan + bloqueo).  
10) Updates: **B** (auto minor; major con consentimiento).  
11) Preview: **C** (vista + sandbox 1‑click con X ejecuciones).  
12) Devoluciones: **C** (política combinada con crédito).  
13) Soporte: **C** (RP9 packs; terceros creator).  
14) Promoción: **B** (algoritmo + curador).  
15) Métricas para creators: **C** (vistas/installs/retención/ingresos).  
16) Licencia/protección: **C** (EULA + trazabilidad + controles suaves).  
17) Adopción por pack (ranking/payout): **C** (ejecuciones + outcome ponderado 60/40).  
18) Bundles/descuentos: **C** (descuento + suscripción pack, mostrar “mejor opción”).  
19) Payouts creators: **C** (mensual + KYC/retenciones por país).  
20) Governance catálogo: **C** (taxonomía + tags + lint CI).

---

## Cómo usar este pack
1. Ejecuta **migración SQL** en Supabase: `infra/supabase/migrations/70_marketplace.sql`.  
2. Configura **.env** y deploya **Netlify Functions** en `apps/functions/marketplace/*`.  
3. Publica el **frontend** del marketplace: `apps/portal/app/(app)/templates/*`.  
4. Activa **Stripe Connect** (Standard) y webhooks (`stripe-webhook-marketplace`).  
5. Habilita sanidad de JSON de n8n con `scripts/sanitize-workflow.ts` en CI.

---

## Entregables
- **SQL** (catálogo, órdenes, payouts, ratings, curation, adoption por pack).  
- **Functions**: listar/preview/instalar/comprar, webhooks Stripe, onboarding de creators, KPIs.  
- **Frontend**: Marketplace (grid, detail, pack, creator center).  
- **Gobernanza**: `marketplace.yml` (revenue split, tiers, linter de metadata).  
- **Utilidades**: sanitizador de workflows, validador de metadata, ejemplos de templates.
