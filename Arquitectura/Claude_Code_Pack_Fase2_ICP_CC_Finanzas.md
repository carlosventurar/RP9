
# Claude Code Pack — Fase 2: ICP & Casos de Uso (Contact Center + Finanzas) — RP9
**Stack:** GitHub · Netlify · Supabase · Stripe · n8n (Railway)  
**Objetivo:** lanzar rápidamente **dos paquetes verticales** (Contact Center y Finanzas) con **webhooks, evidencia auditable y KPIs**.

---

## 0) Resumen táctico
- **Contact Center (CC):** 3CX/Genesys → HubSpot/Zendesk/Freshdesk + WhatsApp CSAT + playbooks de escalamiento.
- **Finanzas (FIN):** validación fiscal (CFDI/DIAN), almacenamiento de **evidencias** en Supabase Storage con **SHA‑256**, asientos contables (QuickBooks/Siigo), **conciliación** por reglas (Belvo/CSV).
- **Seguridad:** HMAC en webhooks, rate‑limit simple, RLS en Supabase; no persistir datos sensibles innecesarios.
- **Fuente de uso:** n8n (Railway) `/api/v1/executions`; se integra con Fase 1 para enforcement/billing.

---

## 1) Master Prompt para Claude Code
Copia/pega este prompt en Claude Code:

```
Eres un ingeniero full‑stack senior. En el monorepo `rp9/` crea el **Pack Fase 2 (ICP)** con:
- Netlify Functions (TypeScript).
- Migraciones Supabase (SQL).
- Páginas Next.js (App Router) y componentes de KPIs.
- Utilidades de seguridad (HMAC, rate‑limit) y acceso a Supabase.

Verticales y entregables:

A) Contact Center (3CX/Genesys → HubSpot/Zendesk/Freshdesk + WhatsApp CSAT)
1) Function `cc-webhooks-call-ended.ts` → recibe call.ended, valida HMAC, normaliza y persiste en `events_cc`.
2) Function `cc-csat-send.ts` → envía CSAT por WhatsApp (provider genérico) con fallback a email.
3) Function `cc-playbook-escalate.ts` → playbook de palabras clave/SLA que crea ticket urgente (HubSpot/Zendesk/Freshdesk vía driver simple).
4) KPI endpoint `kpi-cc.ts` → AHT, p95, CSAT, error rate (últimos 7 días).

B) Finanzas (CFDI/DIAN + evidencia + contabilidad + conciliación)
5) Function `fin-validate.ts` → valida CFDI/DIAN (stub), sube PDF/XML a Supabase Storage, calcula y guarda **SHA‑256** en `evidence_files`.
6) Function `fin-reconcile-run.ts` → ingesta Belvo/CSV, aplica reglas (`reconciliation_rules`) y crea `reconciliation_matches` (matched/exception).
7) KPI endpoint `kpi-fin.ts` → % validación automática, excepciones, horas ahorradas, ciclo medio.

C) Portal (Next.js + Tailwind + shadcn/ui)
8) Página `/evidence` → listado, búsqueda, descarga segura (firma URL y revalida hash); componente `EvidenceTable`.
9) Dashboard: tarjetas CC y FIN, con gráficos Recharts (resumen 7 días).

D) Utilidades
10) `lib/security/hmac.ts` y `lib/rateLimit.ts` (in-memory básico).
11) `lib/supabase.ts` (client admin para Functions).
12) `.env.example` con variables: HMAC, WhatsApp token/url, Supabase, n8n, drivers de CRM/contabilidad.

Requisitos: usar **zod** para validar entradas, logs estructurados, tests stubs, README. No usar datos reales.
```

---

## 2) Estructura de carpetas
```
rp9/
  apps/
    portal/
      app/(app)/dashboard/page.tsx
      app/(app)/evidence/page.tsx
      components/evidence/EvidenceTable.tsx
      components/kpi/CCKPIs.tsx
      components/kpi/FinKPIs.tsx
      public/templates/cc-001.json
      public/templates/cc-002.json
      public/templates/fin-001.json
  apps/functions/
      cc-webhooks-call-ended.ts
      cc-csat-send.ts
      cc-playbook-escalate.ts
      fin-validate.ts
      fin-reconcile-run.ts
      kpi-cc.ts
      kpi-fin.ts
      evidence-get.ts
  infra/supabase/migrations/
      15_icp_cc_fin.sql
  lib/
    security/hmac.ts
    rateLimit.ts
    supabase.ts
    crm/hubspot.ts (stub)
    crm/zendesk.ts (stub)
    crm/freshdesk.ts (stub)
    acct/qbo.ts (stub)
    acct/siigo.ts (stub)
  README_Fase2.md
  .env.example
```

---

## 3) SQL — Supabase (15_icp_cc_fin.sql)
```sql
-- Contact Center: eventos y tickets
create table if not exists events_cc (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  type text not null,           -- call.ended
  provider text not null,       -- 3cx|genesys
  payload jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists tickets (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  crm text not null,            -- hubspot|zendesk|freshdesk
  contact_id text,
  ticket_id text,
  priority text,
  status text,
  csat int,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

-- Evidencia auditable (PDF/XML)
create table if not exists evidence_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  country text,
  workflow_id text,
  path text not null,           -- Supabase Storage key
  sha256 text not null,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz default now()
);

-- Reglas y conciliación
create table if not exists reconciliation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  name text,
  matcher jsonb not null,       -- {contains:"Stripe", amount_delta:2}
  account text,
  created_at timestamptz default now()
);

create table if not exists reconciliation_matches (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  rule_id uuid references reconciliation_rules(id) on delete cascade,
  bank_tx jsonb not null,
  status text not null,         -- matched|exception
  created_at timestamptz default now()
);

-- Índices
create index if not exists idx_events_cc_tenant_time on events_cc (tenant_id, occurred_at desc);
create index if not exists idx_evidence_tenant_time on evidence_files (tenant_id, created_at desc);
create index if not exists idx_recon_tenant_time on reconciliation_matches (tenant_id, created_at desc);
```

---

## 4) Functions — especificaciones rápidas
- **`cc-webhooks-call-ended.ts`**: `POST` con header `x-rp9-signature`; valida HMAC; normaliza payload `{type, provider, started_at, ended_at, agent, customer, meta}`; inserta `events_cc` y opcionalmente dispara `cc-csat-send` si aplica.
- **`cc-csat-send.ts`**: arma mensaje/template WA (score 1–5), persistencia de envío en `tickets` (csat pending → score).
- **`cc-playbook-escalate.ts`**: chequea palabras clave/SLA del evento y crea ticket urgente en CRM elegido (driver stub).
- **`kpi-cc.ts`**: agrega AHT promedio, p95, CSAT promedio, error rate semanal.
- **`fin-validate.ts`**: recibe PDF/XML; valida (stub); sube a Storage; calcula SHA‑256; inserta `evidence_files`.
- **`fin-reconcile-run.ts`**: ingesta Belvo o CSV; aplica reglas de `reconciliation_rules`; genera `reconciliation_matches`; devuelve excepciones.
- **`kpi-fin.ts`**: agrega % validación auto, #excepciones, horas ahorradas (estimación), ciclo medio.
- **`evidence-get.ts`**: firma URL de descarga y **revalida hash** antes de emitir link temporal.

---

## 5) UI — páginas y componentes (extractos)
- `/dashboard`: tarjetas **CC** y **FIN** con `CCKPIs` y `FinKPIs` (Recharts + cards).
- `/evidence`: tabla con búsqueda por fecha/país/workflow, boton de descarga (llama `evidence-get`).
- `EvidenceTable.tsx`: DataTable sencilla con paginación.
- `ExceptionsTable.tsx`: lista de excepciones de conciliación con export CSV.

---

## 6) Payloads — ejemplos
```json
// call.ended (normalizado)
{
  "type": "call.ended",
  "provider": "3cx",
  "call_id": "abc123",
  "started_at": "2025-08-10T16:10:00Z",
  "ended_at": "2025-08-10T16:12:30Z",
  "agent": {"id":"a-77","name":"Maria"},
  "customer": {"phone":"+1*** *** 1234","crm_id":null},
  "meta": {"queue":"ventas","tags":["es"]}
}
```
```json
// evidencia subida (respuesta fin-validate)
{
  "id": "e0a2...",
  "path": "evidence/2025/08/comp-77/invoice_123.xml",
  "sha256": "b23d...",
  "size_bytes": 24567
}
```

---

## 7) Backlog por Sprints
**Sprint 2‑1 (CC básico)**
- Webhook 3CX → `events_cc` + normalizador.
- CSAT WhatsApp (template) + fallback email.
- KPI CC en dashboard.

**Sprint 2‑2 (Genesys + Playbooks + CRMs alternos)**
- Genesys driver + Zendesk/Freshdesk.
- Playbook “palabras clave/SLA” → ticket urgente.
- Logs estructurados + rate‑limit.

**Sprint 2‑3 (Finanzas MX/CO)**
- `fin-validate` con Storage + SHA‑256.
- QuickBooks/Siigo stub (registro contable).
- KPIs FIN + Reporte diario/mensual (descarga CSV).

**Sprint 2‑4 (Conciliación)**
- Ingesta Belvo/CSV.
- Motor de reglas + excepciones.
- UI de excepciones + export CSV.

---

## 8) Criterios de Aceptación
- `call.ended` crea registro y dispara CSAT en <60s; fallback email si WA falla.
- KPIs CC: AHT/p95/CSAT/errores correctos 7 días.
- `fin-validate` guarda evidencia y **verifica hash** en descarga.
- Conciliación aplica reglas y lista excepciones; export CSV operativo.

---

## 9) Variables de entorno (`.env.example`)
```
# n8n (Railway)
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__

# Supabase
SUPABASE_URL=__SETME__
SUPABASE_SERVICE_ROLE_KEY=__SETME__

# Seguridad
HMAC_SECRET=__SETME__
RATE_LIMIT_MAX=300
RATE_LIMIT_WINDOW_MS=60000

# WhatsApp provider (ej. Cloud API o gateway)
WA_API_URL=__SETME__
WA_TOKEN=__SETME__
WA_TEMPLATE_ID=csat_template_es

# CRM/Contabilidad (stubs)
CRM_PROVIDER=hubspot # o zendesk|freshdesk
HUBSPOT_TOKEN=__SETME__
ZENDESK_DOMAIN=__SETME__
ZENDESK_TOKEN=__SETME__
FRESHDESK_DOMAIN=__SETME__
FRESHDESK_TOKEN=__SETME__
QBO_KEY=__SETME__
SIIGO_TOKEN=__SETME__
```

---

## 10) Notas
- Mantén **HMAC** consistente entre n8n ↔ Functions para webhooks.
- Usa **RLS** y **service role** solo en Functions del backend.
- Anonimiza datos sensibles (teléfonos, RFC/NIT) antes de loguear.
- Reutiliza métricas/usage de Fase 1 para pricing/overage.
