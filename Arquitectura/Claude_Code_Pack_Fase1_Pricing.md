
# Claude Code Pack — Fase 1: Oferta & Pricing (RP9)
**Stack:** GitHub · Netlify · Supabase · Stripe · n8n (Railway)  
**Objetivo de la fase:** lanzar pricing vendible con checkout, metered usage por ejecución, add‑ons y enforcement básico.

---

## 0) Contexto y metas
- Planes: **Starter / Pro / Enterprise** (toggle mensual/anual −20%).
- **Overage** por ejecución: **0.002 USD**.
- **Paquetes extra** de ejecuciones: 10k/50k/100k.
- **Add‑ons verticales**: Contact Center y Finanzas (activables por flags).
- **Checkout** self‑serve (Starter/Pro) y **sales‑assisted** (Enterprise con invoice).
- **Dunning**: 3 reintentos + email + WhatsApp opcional.
- **Enforcement**: alertas 80%/100%, gracia 48h, auto‑upgrade si 2 meses seguidos superan límite.
- Fuente de usage: **n8n** en Railway → `/api/v1/executions` (owner API key).

---

## 1) Master Prompt para Claude Code
Copia/pega este prompt en Claude Code para que genere el stack de Fase 1:

```
Eres un ingeniero full‑stack senior. En el monorepo `rp9/` (Node 18) crea:
- `apps/portal` (Next.js App Router + Tailwind + shadcn/ui),
- `apps/functions` (Netlify Functions TS),
- `infra/supabase/migrations` (SQL).

Conecta **Stripe** (suscripciones + metered usage) y **n8n (Railway)** usando `N8N_BASE_URL=https://primary-production-7f25.up.railway.app` y `X-N8N-API-KEY`. Entregables:

A) Pricing & Checkout
1) `app/(mkt)/pricing` con toggle mensual/anual (‑20%), 3 planes, add‑ons y “Iniciar piloto”.
2) `components/mkt/ROIForm.tsx` (eventos/mes × minutos ahorrados × costo/hora) con CTA a checkout.
3) Netlify Function `billing-checkout.ts` (POST) → sesión de Stripe para Starter/Pro (con addons y periodicidad). Enterprise → formulario → CRM stub.

B) Usage & Metered
4) `usage-collector.ts` (scheduled) → pulls `/executions` de n8n y persiste en `usage_executions` (idempotente).
5) `stripe-webhook.ts` maneja `checkout.session.completed`, `invoice.paid/failed`, `customer.subscription.updated` (actualiza `subscriptions`).

C) Enforcement & Dunning
6) `enforcement.ts` (scheduled) → calcula consumo/límites, envía alertas 80/100%, aplica gracia 48h y auto‑upgrade si flag activo.
7) Página `/billing` (plan, consumo, facturas, upgrade/downgrade).

D) Seguridad & DX
8) Validación con **zod**, rate‑limit simple, logs estructurados, README y `.env.example`.
9) Seeds de `plans` y tests básicos (mocks Stripe).

No uses datos reales. Provee stubs y ejemplos listos para completar credenciales.
```

---

## 2) Estructura de carpetas (Fase 1)
```
rp9/
  apps/
    portal/
      app/(mkt)/pricing/page.tsx
      app/(app)/billing/page.tsx
      components/mkt/PlanCard.tsx
      components/mkt/ROIForm.tsx
    functions/
      billing-checkout.ts
      stripe-webhook.ts
      usage-collector.ts
      enforcement.ts
  infra/
    supabase/migrations/10_pricing.sql
  tests/
    readme.md
  .env.example
  README_Fase1.md
```

---

## 3) SQL — Supabase (10_pricing.sql)
(versión resumida, completa en el ZIP)
```sql
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'starter',
  owner_user uuid not null,
  country text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists plans (
  key text primary key,
  name text not null,
  price_id text,             -- Stripe price mensual
  price_id_yearly text,      -- Stripe price anual
  limits jsonb not null      -- {executions: int, editors: int}
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  current_period_end timestamptz
);

create table if not exists usage_executions (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  workflow_id text,
  execution_id text unique,
  status text,
  started_at timestamptz,
  stopped_at timestamptz,
  duration_ms bigint,
  created_at timestamptz default now()
);

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  scope text default 'tenant'
);
```

---

## 4) Netlify Functions — especificaciones

### `billing-checkout.ts` (POST)
- Entrada: `{ plan: 'starter'|'pro'|'enterprise', period: 'monthly'|'yearly', addons?: string[], tenantId?: string }`.
- Starter/Pro → crea `checkout.session` con `price_id` correspondiente y line items de add‑ons.
- Enterprise → responde con `{ leadUrl }` (stub CRM o mailto).
- Devuelve `{ url }` para redirigir a Stripe.

### `stripe-webhook.ts` (POST)
- Verifica firma (`STRIPE_WEBHOOK_SECRET`).
- Maneja `checkout.session.completed`, `invoice.paid/failed`, `customer.subscription.updated`.
- Actualiza `subscriptions` y flags.

### `usage-collector.ts` (scheduled)
- Cada 5–10 min: `GET {N8N_BASE_URL}/api/v1/executions?limit=50&status=success|error&lastId=` por tenant.
- Inserta en `usage_executions` (idempotencia por `execution_id`).

### `enforcement.ts` (scheduled)
- Calcula uso vs límite por tenant.
- Envía alertas 80%/100% (Slack/email) y aplica **gracia 48h**.
- Auto‑upgrade si `autoUpgrade=true` y 2 meses consecutivos superan límite.

---

## 5) UI — Pricing + ROI (extractos)
- `PlanCard.tsx`: props `{ name, price, features[], cta }` con estilo RP9 (simple/limpio).
- `pricing/page.tsx`: 3 columnas, toggle mensual/anual, add‑ons (checkbox) y botón “Continuar” que llama `billing-checkout`.
- `ROIForm.tsx`: muestra ahorro estimado `$` y CTA a piloto/checkout.

---

## 6) Variables de entorno (`.env.example`)
```
# n8n (Railway)
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__

# Stripe
STRIPE_SECRET_KEY=__SETME__
STRIPE_WEBHOOK_SECRET=__SETME__
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_ADDON_EXEC_10K=price_xxx
STRIPE_PRICE_ADDON_EXEC_50K=price_xxx
STRIPE_PRICE_ADDON_EXEC_100K=price_xxx

# Supabase
SUPABASE_URL=__SETME__
SUPABASE_ANON_KEY=__SETME__
SUPABASE_SERVICE_ROLE_KEY=__SETME__

# Misc
JWT_SECRET=__SETME__
SLACK_WEBHOOK_URL=__SETME__ # opcional para alertas
```

---

## 7) Backlog por Sprints (3 semanas)
**Sprint 1 – Pricing Core**
- Pricing UI + toggle mensual/anual
- Function `billing-checkout`
- Seeds tabla `plans` y `.env.example`

**Sprint 2 – Metered & Webhook**
- Function `usage-collector` (cron)
- Tabla `usage_executions` + idempotencia
- `stripe-webhook` (estado de suscripciones)

**Sprint 3 – Enforcement & Dunning**
- Function `enforcement` (alertas/gracia/auto‑upgrade)
- Página `/billing` con consumo y facturas
- Dunning (reintentos y avisos)

---

## 8) Criterios de Aceptación
- Checkout operativo en Starter/Pro y redirección correcta.
- Uso desde n8n visible en `/billing` y almacenado en `usage_executions`.
- Alertas 80/100% enviadas; gracia aplicada; auto‑upgrade respetando flag.
- ROI empuja tráfico a checkout/piloto.

---

## 9) Notas
- Mantén `X-N8N-API-KEY` del **owner** por tenant en servidor/secret manager.
- Si quieres “pausar” al 100%, usa bandera `suspended=true` en `tenants` y bloquea llamadas en BFF.
- Anonimiza payloads en métricas si contienen datos sensibles.
