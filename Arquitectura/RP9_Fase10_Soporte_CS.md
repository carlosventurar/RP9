# RP9 — Fase 10: Soporte, SLAs & Customer Success
_Fecha_: 2025-08-13

Este documento consolida **20 decisiones** (se eligió la **recomendación** en todos los casos) y entrega un **Claude Code Pack** listo para implementar el stack de Soporte/CS: tablas Supabase, Functions (Netlify), páginas de portal y cron jobs.

---

## 1) Decisiones seleccionadas (20/20)

**1. Modelo de Soporte por plan** → B) Escalonado por plan: Starter (email 8x5) · Pro (email + chat 8x5) · Enterprise (email+chat 24/5 + Slack compartido).

**2. FRT objetivo** → B) Starter 8h, Pro 4h, Ent 1h.

**3. SLA por severidad P1–P3** → B) P1: 2h restore, P2: 8h, P3: 2 días.

**4. Horario de soporte humano** → A) 8x5 (L–V) con guardias P1 24/5.

**5. Canales** → C) Email + chat + Slack compartido (Enterprise).

**6. Herramienta de soporte** → B) HubSpot Service Hub (integra con ventas).

**7. Base de conocimiento** → B) Docs en portal (MDX) + feedback por artículo.

**8. Estado y comunicaciones** → B) Statuspage/BetterStack + plantillas de incidente.

**9. RCA/RFO** → C) RCA en 72h P1, 5 días P2/3.

**10. Mantenimiento programado** → B) Quincenal 1h, domingos madrugada.

**11. Onboarding post‑venta (CS)** → A) Kickoff + checklist + wizard in‑app.

**12. QBR/EBR** → A) Trimestral Enterprise; Semestral Pro.

**13. Health Score** → A) Uso, éxito, incidentes, NPS.

**14. Playbooks de éxito** → A) Activación D7, Adopción 30d, Expansión 60–90d.

**15. Gestión de feature requests** → C) Portal público + captura interna priorizada.

**16. Escalamiento interno** → A) Soporte → CS → Ingeniería (on‑call P1).

**17. SLOs internos** → A) Uptime 99.5%, error<1%, p95 webhook<1s.

**18. NPS/CSAT** → A) NPS trimestral + CSAT por ticket + post‑flujo.

**19. Criterio listo para prod** → A) 30 días sin P1 + éxito>97% + >3 flujos críticos.

**20. Renovaciones & dunning** → A) Auto‑renew 12m; aviso 60/30/15; dunning 3 intentos.


## 2) Master Prompt (Claude Code) — implementar Fase 10

> Actúa como Staff Engineer (full‑stack). En el monorepo `rp9/` crea el **stack de Soporte, SLAs & Customer Success** usando **GitHub + Netlify + Supabase + HubSpot Service Hub** (y Slack/Statuspage/BetterStack). Entrega código tipado (TypeScript), validación con `zod`, RLS en Supabase, tests básicos y README. Evita datos reales: usa stubs/mocks. Mi n8n vive en `https://primary-production-7f25.up.railway.app/` (solo para métricas de uso incidente/éxito).

### A. Apps (Next.js App Router + Tailwind + shadcn/ui)
- `apps/portal/app/(app)/support`:
  - `/support` (lista de tickets del tenant; filtros por severidad/estado/canal).
  - `/support/new` (crear ticket: severidad P1–P3; canal = email/chat).
  - `/support/incidents` (incidentes abiertos, impacto y ETA).
  - `/support/kb` (KB en MDX con búsqueda y feedback 1‑5 estrellas).
  - `/support/sla` (matriz SLA por plan y severidad; FRT/restore targets).
  - `/support/health` (health score, NPS/CSAT, adopción por pack).
- `apps/portal/app/(admin)/cs` (solo internal role):
  - `/cs/playbooks` (Activación D7, Adopción 30d, Expansión 60–90d).
  - `/cs/rca` (lista de RCA; crear/editar; export Markdown/PDF).
  - `/cs/qbr` (planificador QBR/EBR; minutas y objetivos).

### B. Netlify Functions (TypeScript)
- `functions/support-create-ticket.ts` → crea ticket en **HubSpot Service Hub** y guarda en Supabase.
- `functions/support-webhook.ts` → ingesta webhooks de HubSpot (status/severity/notes) y sync Supabase.
- `functions/status-incident.ts` → crea/actualiza incidentes y publica en **Statuspage/BetterStack** (adapter).
- `functions/rca-generate.ts` → genera **RCA** desde plantilla (MD → Storage) con metadatos.
- `functions/kb-feedback.ts` → recibe rating 1–5 y comentario por artículo.
- `functions/cs-healthscore.ts` (scheduled) → calcula Health Score diario (uso n8n, éxito, incidentes, NPS).
- `functions/qbr-scheduler.ts` (scheduled) → crea próximas QBR/EBR y envía invitaciones.
- `functions/renewal-dunning.ts` (scheduled) → notifica renovación 60/30/15 días y ejecuta dunning (3 intentos).
- `functions/nps-csat.ts` → envía/recibe **NPS trimestral** y **CSAT post‑ticket/flujo** (email/WA stub).
- `functions/feature-requests.ts` → portal público con voto; backoffice prioriza por impacto/ARR.

### C. Supabase SQL (RLS + índices)
- Tablas: `support_plans`, `sla_matrix`, `tickets`, `ticket_events`, `incidents`, `incident_updates`, `rca_docs`, `kb_articles`, `kb_feedback`, `cs_health_scores`, `qbrs`, `renewals`, `feature_requests`.
- Todas con `tenant_id` y RLS por tenant (policy básica + roles internos).

### D. Integraciones
- **HubSpot Service Hub** (Tickets API): adapter `lib/support/hubspot.ts`.
- **Status provider**: adapter `lib/status/provider.ts` con drivers `statuspage`, `betterstack` (no real creds).
- **Slack**: webhook para avisos P1 y cambios de estado.

### E. UX
- Matriz SLA clara (badges por severidad, contadores FRT/resto).
- KB con MDX + buscador, feedback por artículo y “related articles”.
- Health Score con breakdown (uso, éxito, incidentes, NPS), semáforo (Rojo/Amarillo/Verde).

### F. Entregables mínimos
- Migración SQL `infra/supabase/migrations/30_support_cs.sql`.
- Netlify functions arriba descritas (con validación `zod`).
- Páginas Next.js listadas.
- `.env.example`, `netlify.toml` (cron para 3 scheduled), y tests básicos.

**Variables clave**: ver `.env.example` más abajo.


## 3) Supabase SQL — 30_support_cs.sql

```sql
-- Soporte & CS core
create table if not exists support_plans (
  key text primary key,               -- starter|pro|enterprise
  channels jsonb not null,            -- ["email","chat","slack"]
  frt_minutes int not null,           -- objetivo de 1ª respuesta (plan baseline)
  created_at timestamptz default now()
);

create table if not exists sla_matrix (
  id uuid primary key default gen_random_uuid(),
  plan_key text references support_plans(key) on delete cascade,
  severity text not null,             -- P1|P2|P3
  frt_minutes int not null,
  restore_minutes int not null,
  created_at timestamptz default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  subject text not null,
  description text,
  severity text not null,             -- P1|P2|P3
  channel text not null,              -- email|chat|slack
  status text not null default 'open',-- open|in_progress|waiting|resolved|closed
  assignee text,
  hubspot_ticket_id text,             -- id externo
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tickets_tenant on tickets(tenant_id, created_at desc);

create table if not exists ticket_events (
  id bigserial primary key,
  ticket_id uuid references tickets(id) on delete cascade,
  at timestamptz default now(),
  type text not null,                 -- status_change|note|assignment
  meta jsonb
);

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  title text not null,
  severity text not null,             -- P1|P2|P3
  status text not null default 'investigating', -- investigating|identified|monitoring|resolved
  impact text,
  eta timestamptz,
  status_provider_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists incident_updates (
  id bigserial primary key,
  incident_id uuid references incidents(id) on delete cascade,
  at timestamptz default now(),
  status text not null,
  message text not null
);

create table if not exists rca_docs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  incident_id uuid references incidents(id) on delete set null,
  title text,
  md_path text,                       -- Storage key del MD/PDF
  owner uuid,
  due_date timestamptz,
  created_at timestamptz default now()
);

create table if not exists kb_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,                     -- null = público
  slug text unique,
  title text,
  tags text[] default '{}',
  mdx_path text not null,
  created_at timestamptz default now()
);

create table if not exists kb_feedback (
  id bigserial primary key,
  article_id uuid references kb_articles(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create table if not exists cs_health_scores (
  id bigserial primary key,
  tenant_id uuid not null,
  score int not null,                 -- 0-100
  breakdown jsonb not null,           -- {usage:.., success:.., incidents:.., nps:..}
  created_at timestamptz default now()
);

create table if not exists qbrs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  scheduled_for timestamptz not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists renewals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  renew_on date not null,
  status text default 'pending',      -- pending|reminded|renewed|churned
  created_at timestamptz default now()
);

create table if not exists feature_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  title text not null,
  description text,
  votes int default 0,
  status text default 'new',          -- new|planned|in_progress|done
  impact text,                        -- texto libre
  arr_impact numeric,                 -- estimado
  created_at timestamptz default now()
);

-- RLS (ejemplo mínimo; ajustar a tu política)
alter table tickets enable row level security;
create policy tickets_by_tenant on tickets
  using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id');

alter table incidents enable row level security;
create policy incidents_by_tenant on incidents
  using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id');

alter table cs_health_scores enable row level security;
create policy health_by_tenant on cs_health_scores
  using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id');
```


## 4) Netlify Functions — especificación + esqueletos

**Común**: cada handler valida input con `zod`, escribe logs estructurados, y responde `{ ok: true }`.
Usa `X-RP9-Signature` (HMAC) opcional para endpoints públicos.

### `support-create-ticket.ts` (POST)
Crea ticket en HubSpot y en `tickets`. Campos: `{ tenantId, subject, description, severity, channel }`.

```ts
import { Handler } from '@netlify/functions'
export const handler: Handler = async (event) => {
  try {
    const body = JSON.parse(event.body||'{}')
    // validar, llamar HubSpot, insertar Supabase
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (e:any) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) }
  }
}
```

### `support-webhook.ts` (POST)
Ingesta de webhooks de HubSpot (ticket updated). Actualiza `tickets` y agrega `ticket_events`.

### `status-incident.ts` (POST)
Crea/actualiza incidentes, publica update en Statuspage/BetterStack (adapter).

### `rca-generate.ts` (POST)
Genera documento RCA en Storage (MD → PDF opcional). Guarda registro en `rca_docs`.

### `kb-feedback.ts` (POST)
Guarda `rating` y `comment` por artículo en `kb_feedback`.

### `cs-healthscore.ts` (SCHEDULED)
Calcula Health Score diario: inputs = uso n8n (ejecuciones/éxito), incidentes abiertos últimos 30d, último NPS.
Guarda `cs_health_scores` y envía alerta si baja de umbral.

### `qbr-scheduler.ts` (SCHEDULED)
Crea eventos QBR próximos 90 días para tenants Pro/Ent; envía invitaciones (email stub).

### `renewal-dunning.ts` (SCHEDULED)
Chequea `renewals` (60/30/15 días) → envía recordatorios y marca estado; ejecuta dunning (3 intentos).

### `nps-csat.ts` (POST + webhook)
Envía NPS trimestral; recibe respuestas NPS/CSAT y persiste (tabla puede ser `cs_health_scores` con breakdown.nps/csat).


## 5) Portal — páginas/componentes

- `/support` → tabla de tickets con filtros (estado/severidad/canal), botón **Nuevo ticket**.
- `/support/new` → formulario (subject, descripción, severidad P1–P3, adjuntos opcionales).
- `/support/incidents` → listado de incidentes, badge de estado, ETA, enlace a página de status externa.
- `/support/kb` → grid de artículos MDX, buscador por título/tags, botón “¿Te sirvió?” (feedback).
- `/support/sla` → matriz SLA por plan (Starter/Pro/Ent) y severidad (FRT/restore).
- `/support/health` → **Health Score** con breakdown, NPS/CSAT últimos 90d, tendencias.

**Admin CS** (role internal):
- `/cs/playbooks` → tarjetas por Activación/Adopción/Expansión con checklist.
- `/cs/rca` → listado + editor MD para RCA (plantilla).
- `/cs/qbr` → calendario/lista de QBR planificados; export minutos PDF.


## 6) Backlog por Sprints

**Sprint CS‑1 (Core soporte)**
- [ ] Migración `30_support_cs.sql` y RLS básica.
- [ ] `support-create-ticket`, `support-webhook` (HubSpot adapter).
- [ ] Páginas `/support`, `/support/new`, `/support/sla`.

**Sprint CS‑2 (Incidentes & KB)**
- [ ] `status-incident` + adapter status provider (stub).
- [ ] `/support/incidents` + Status badge/ETA.
- [ ] KB MDX + `/support/kb` + `kb-feedback`.

**Sprint CS‑3 (Health & QBR)**
- [ ] `cs-healthscore` (scheduled) + `/support/health` UI.
- [ ] `qbr-scheduler` y `/cs/qbr` admin.
- [ ] `nps-csat` y visualización en Health.

**Sprint CS‑4 (Renovaciones & Playbooks)**
- [ ] `renewal-dunning` (scheduled) y cron en `netlify.toml`.
- [ ] `/cs/playbooks` (checklists Activation/Adoption/Expansion).
- [ ] Refinar escalamiento interno (Soporte→CS→Eng, on‑call P1).


## 7) Variables de entorno (.env.example)

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# HubSpot Service Hub (Tickets)
HUBSPOT_PRIVATE_APP_TOKEN=prv-xxx

# Slack
SLACK_WEBHOOK_URL=

# Status provider (elige uno; usa stubs si no tienes cuenta)
STATUS_PROVIDER=statuspage   # o betterstack
STATUSPAGE_API_TOKEN=
STATUSPAGE_PAGE_ID=
BETTERSTACK_API_TOKEN=

# NPS/CSAT (stubs)
EMAIL_PROVIDER_API_KEY=
WHATSAPP_PROVIDER_TOKEN=

# JWT para RLS (si aplicas)
JWT_SECRET=supersecret
```


## 8) netlify.toml — schedules

```toml
[build]
  command = "npm run build"
  publish = "apps/portal/out"

[[plugins]]
  package = "@netlify/plugin-functions-install-core"

[functions]
  external_node_modules = ["zod"]

# Schedules (UTC)
[[scheduled]]
  path = "/.netlify/functions/cs-healthscore"
  schedule = "0 3 * * *"

[[scheduled]]
  path = "/.netlify/functions/qbr-scheduler"
  schedule = "0 4 * * 1"

[[scheduled]]
  path = "/.netlify/functions/renewal-dunning"
  schedule = "0 5 * * *"
```


## 9) Criterios de aceptación (Fase 10)

- Crear ticket desde portal → aparece en HubSpot y en Supabase; SLA/FRT visibles y contadores funcionando.
- Webhook de HubSpot cambia estado/severidad y se refleja en `/support` con evento añadido.
- Crear incidente P1 y publicar update → visible en `/support/incidents` y en proveedor de status (stub ok).
- Health Score diario calculado y mostrado con breakdown; alerta si baja de umbral.
- KB navegable con MDX y feedback 1–5; reporte de artículos con peor/ mejor utilidad.
- QBR planificados (Pro/Ent) y renovación con avisos 60/30/15 días (logs de dunning simulados).

# RP9 — Fase 10: Soporte, SLAs & Customer Success

**Fecha:** 2025-08-11

## Decisiones (20/20) — Selección = Recomendación
1) Modelo soporte: **B** (escalonado por plan).  
2) FRT: **B** (8h/4h/1h).  
3) SLA por severidad: **B** (P1 2h restore; P2 8h; P3 2d).  
4) Horario: **A** (8x5 + guardias P1 24/5).  
5) Canales: **C** (email+chat+Slack Enterprise).  
6) Herramienta: **B** (HubSpot Service Hub).  
7) KB: **B** (docs MDX + feedback).  
8) Status: **B** (Statuspage/BetterStack).  
9) RCA: **C** (P1 72h; P2/3 5 días).  
10) Mantenimiento: **B** (quincenal 1h, domingo madrugada).  
11) Onboarding CS: **A** (Kickoff + wizard).  
12) QBR/EBR: **A** (Ent Q trimestral; Pro semestral).  
13) Health Score: **A** (uso, éxito, incidentes, NPS).  
14) Playbooks: **A** (D7/D30/D60).  
15) Feature requests: **C** (portal + priorización interna).  
16) Escalamiento: **A** (Soporte→CS→Ingeniería, on-call P1).  
17) SLOs: **A** (99.5% / <1% / p95 <1s).  
18) NPS/CSAT: **A** (NPS trimestral + CSAT por ticket/flujo).  
19) Ready for Prod: **A** (30d sin P1, éxito>97%, ≥3 flujos críticos).  
20) Renovaciones & dunning: **A** (auto‑renov 12m; 60/30/15; 3 intentos).

## Instrucciones rápidas
- Aplica SQL `infra/supabase/migrations/50_support.sql`.
- Configura `.env.example` y despliega **Netlify Functions** en `apps/functions/`.
- Publica KCS (MDX) y enlaza **Status Page** desde el portal.
- Programa `support-sla-watch` cada 5–10 min (Netlify Scheduled Functions).
