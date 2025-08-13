# RP9 — Fase 11: Analítica & Reporting (Funnels, TTV, Horas Ahorradas, Adopción por Pack)

**Stack:** GitHub · Netlify Functions (TS) · Supabase (Postgres/Storage/RLS) · Stripe · n8n (Railway: `https://primary-production-7f25.up.railway.app/`).  
**Objetivo:** medir valor de negocio (ROI USD/mes), acelerar TTV, detectar adopción por pack y prevenir problemas con alertas.

---

## 0) Decisiones (tomadas = *recomendación* en cada pregunta)

1) **North Star Metric** → **C**: *ROI estimado en USD/mes* (+ A como operativa).  
2) **Definición de TTV** → **C**: *primer outcome real* (ticket/CFDI/envío).  
3) **Funnel principal** → **C**: *Wizard + 1‑click template + primera ejecución + outcome*.  
4) **Cohorts** → **C**: semanales (activación) + mensuales (retención).  
5) **Horas ahorradas/flujo** → **C**: metadato por plantilla **+** baseline/override por cliente.  
6) **Stack de datos** → **C**: Supabase ahora; BigQuery luego si >50M eventos/mes.  
7) **Instrumentación** → **A**: frontend + BFF + eventos de n8n.  
8) **Latencia** → **C**: RT para salud; horario para ROI/finanzas.  
9) **Dashboards** → **A+B+C**: ejecutivo, operaciones y financiero.  
10) **Adopción por pack** → **C**: uso + outcome (señal de resultado).  
11) **Alertas** → **C**: caída éxito/lag/horas ahorradas (cuentas clave).  
12) **Atribución** → **C**: U‑shaped (UTM).  
13) **Catálogo KPIs** → **C**: TTV (P50/75), NSM (USD/horas), activación, errores/p95, activos, packs, MRR/ARPU.  
14) **Periodicidad reportes** → **C**: semanal Slack + mensual PDF/email.  
15) **Export/Share** → **C**: CSV/Excel + PDF programado + share link + Slack.  
16) **Data Quality** → **C**: monitoreo lag + backfill + tablero salud.  
17) **1ª victoria (TTV)** → **A**: primer outcome real.  
18) **Meta TTV** → **A**: ≤72h (P50), ≤7d (P75).  
19) **Governance** → **C**: `metrics.yml` versionado + tests en CI.  
20) **Privacidad/PII** → **C**: UUIDs; PII hasheada; retención 12–24m configurable.

---

## 1) Claude Code — Master Prompt (copia/pega)

**Usa este prompt en Claude Code para generar el módulo completo de Analítica & Reporting:**

> Eres un ingeniero de datos/aplicaciones senior. En el monorepo `rp9/` añade el paquete **Fase 11 – Analítica & Reporting** usando **Netlify Functions (TypeScript)**, **Supabase** y **Next.js**. Conecta con n8n en `https://primary-production-7f25.up.railway.app/`. Implementa:
> 
> **A. Ingesta & Tracking**
> 1) Instrumentación del **portal (frontend)** y **BFF**: eventos `funnel_*`, `outcome_*`, `ui_*` con sesión y `tenant_id`.  
> 2) **Collector n8n** (cada 10 min) que consulta `/api/v1/executions` y persiste en `usage_executions` (idempotente).  
> 3) **Lag monitor**: compara ejecutadas esperadas vs recibidas; emite alerta Slack si lag>20 min.
> 
> **B. Modelo de datos (SQL)** – crea migración `40_analytics.sql`:
> - `funnel_events(tenant_id, user_id, step, meta, occurred_at)` (cohorts weekly/monthly).  
> - `outcomes(tenant_id, kind, workflow_id, value_numeric, meta, occurred_at)` para *primer outcome*.  
> - `savings_baseline(tenant_id, workflow_id, minutes_per_event, hourly_cost)` y `templates_metadata(workflow_key, default_minutes)` para *horas ahorradas*.  
> - Rollups: `kpi_rollups_daily`, `kpi_rollups_monthly`.  
> - Vistas materializadas: `mv_funnels_daily`, `mv_ttv_cohorts_weekly`, `mv_adoption_pack`, `mv_nsm_usd`.  
> - RLS por `tenant_id` y políticas de sólo‑lectura para vistas.
> 
> **C. Agregación & KPIs**
> 4) Function **`analytics-aggregate`** (hourly): actualiza rollups y vistas materializadas.  
> 5) Function **`analytics-kpis`** (GET): retorna JSON para **tres dashboards** (Ejecutivo, Operaciones, Financiero) con filtros (rango, tenant, pack).  
> 6) Function **`analytics-alerts`** (scheduled): detecta anomalías (éxito −20%, p95 +50%, horas ahorradas −25%) y envía Slack/Email.
> 
> **D. Reportes & Export**
> 7) **PDF mensual** con resumen ejecutivo por tenant (logo, ROI, TTV, adopción) – `analytics-report` (programado).  
> 8) **Export** CSV/Excel on‑demand – `analytics-export` (POST con query predefinida).
> 
> **E. Portal (Next.js)**
> 9) Páginas `/analytics` con tabs **Ejecutivo / Operaciones / Finanzas**; `/analytics/funnels`, `/analytics/ttv`, `/analytics/packs`, `/analytics/nsm`.  
> 10) Componentes (Recharts): *ROICard, TTVCohorts, AdoptionByPack, DataHealth, TopWorkflowsCost*; share link + export.  
> 11) **i18n es‑LatAm**. Dark mode y UI moderna (Tailwind + shadcn/ui).
> 
> **F. Calidad & Privacidad**
> 12) `metrics.yml` (definiciones, owners, fórmulas) versionado.  
> 13) Tests de consistencia (CI): compara KPIs API vs SQL directo.  
> 14) PII: emails/teléfonos **hasheados**; `retention_months` por plan (12/24); tareas de purga.
> 
> **Configura** `netlify.toml` con crons: *collector* cada 10 min, *aggregate* hourly, *report* mensual. Incluye `.env.example` con todas las variables. No uses datos reales; agrega *seeds mocks* y README con pasos de despliegue.
> 

---

## 2) Esquema de Datos (SQL)

El archivo `infra/supabase/migrations/40_analytics.sql` incluye tablas, índices, vistas y RLS. **Resumen:**

- **Eventos de funnel**
- **Outcomes** (1ª victoria / outcomes continuos)
- **Baselines de ahorro** (`minutes_per_event`, `hourly_cost` por tenant/workflow)
- **Metadatos de plantillas** (minutos default por evento)
- **Rollups diarios/mensuales** y **vistas materializadas** para dashboards
- **Políticas RLS** por `tenant_id`

> Ver el archivo SQL adjunto para el detalle.

---

## 3) Netlify Functions (API + Schedules)

- `analytics-ingest.ts` — Ingesta de eventos del portal/BFF (`funnel_*`, `ui_*`, `outcome_*`).  
- `analytics-collector.ts` — Cada 10 min, trae ejecuciones de n8n y guarda (idempotente).  
- `analytics-aggregate.ts` — Cada hora, recalcula rollups y *refresh materialized views*.  
- `analytics-kpis.ts` — `GET` con filtros; entrega KPIs para tabs Ejecutivo/Operaciones/Finanzas.  
- `analytics-alerts.ts` — Detecta anomalías y envía alertas (Slack/Email).  
- `analytics-report.ts` — Genera PDF mensual y envía por email/Slack.  
- `analytics-export.ts` — CSV/Excel bajo queries predefinidas (seguro).

**Cron sugerido (`netlify.toml`)**:
- `*/10 * * * *` → collector
- `15 * * * *` → aggregate
- `0 9 1 * *` → report (1º de cada mes, 09:00)

---

## 4) Portal — Vistas y Componentes

- **Ejecutivo:** ROI USD/mes (NSM), TTV P50/75, Adopción por pack, MRR/ARPU (referencia), top outcomes.  
- **Operaciones:** éxito/errores, p95, colas pendientes, *Top Workflows por costo estimado*.  
- **Finanzas:** consumo metered, overage proyectado, ahorro (horas×costo/h), márgenes estimados.

Componentes (Recharts):
- `ROICard`, `TTVCohorts`, `AdoptionByPack`, `DataHealth`, `TopWorkflowsCost` (tooltips + export).

---

## 5) Governance & Privacidad

- `content/metrics.yml` con owner, definición, fórmula, tabla/vista y SLO por métrica.  
- Pruebas CI de consistencia (API vs SQL).  
- PII **hasheada** (SHA‑256 + salt); **retención** por plan (12/24m); tareas de purga.

---

## 6) Backlog por Sprints

**Sprint A (Ingesta & Modelo)**  
- [ ] Instrumentar portal/BFF (eventos) y collector n8n (idempotente).  
- [ ] Migración `40_analytics.sql` con tablas, índices y vistas MV.  
- [ ] `analytics-ingest` + `analytics-collector` + `analytics-aggregate` + `analytics-kpis` (mínimo).

**Sprint B (Dashboards & Alertas)**  
- [ ] Tabs `/analytics` con componentes base y filtros.  
- [ ] `analytics-alerts` (éxito −20%, p95 +50%, lag >20m, horas −25% en cuentas clave).  
- [ ] `metrics.yml` + tests de consistencia.

**Sprint C (Reportes & Share)**  
- [ ] `analytics-report` mensual (PDF) + envío.  
- [ ] `analytics-export` CSV/Excel + share links con expiración.  
- [ ] Documentación (README) + seeds de ejemplo.

---

## 7) Criterios de Aceptación

- TTV P50 ≤ **72h**, P75 ≤ **7d** visible por cohort.  
- NSM (ROI USD/mes) se calcula y muestra por tenant, con fuente (horas×costo).  
- Adopción por pack = uso **+ outcome**; visible por tenant y global.  
- Alertas automáticas en Slack/Email ante caídas/anomalías.  
- Reporte mensual PDF entregado (compartible) y export CSV disponible.

---

## 8) Variables de Entorno (.env.example)

```
# n8n (Railway)
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__

# Supabase
SUPABASE_URL=__SETME__
SUPABASE_ANON_KEY=__SETME__
SUPABASE_SERVICE_ROLE_KEY=__SETME__

# Notificaciones
SLACK_WEBHOOK_URL=__SETME__
EMAIL_FROM=no-reply@rp9.io
EMAIL_PROVIDER_API_KEY=__SETME__

# Seguridad
HMAC_SECRET=__SETME__
JWT_SECRET=__SETME__

# Reportes
REPORT_BRAND_LOGO_URL=https://rp9.io/logo.png
REPORT_TIMEZONE=America/Mexico_City
```

---

## 9) netlify.toml (crons)

```toml
[build]
  command = "npm run build"
  publish = "apps/portal/.next"

[[edge_functions]]
  function = "analytics-kpis"
  path = "/api/analytics/kpis"

# Programadas
[[scheduled]]
  path = "/.netlify/functions/analytics-collector"
  schedule = "*/10 * * * *"

[[scheduled]]
  path = "/.netlify/functions/analytics-aggregate"
  schedule = "15 * * * *"

[[scheduled]]
  path = "/.netlify/functions/analytics-report"
  schedule = "0 9 1 * *"
```

---

## 10) Queries útiles (ejemplos)

```sql
-- TTV por cohort semanal (P50/P75)
select cohort_week,
  percentile_cont(0.5) within group (order by ttv_hours) as p50,
  percentile_cont(0.75) within group (order by ttv_hours) as p75
from mv_ttv_cohorts_weekly
where tenant_id = :tenant
group by cohort_week
order by cohort_week;

-- ROI mensual (USD) por tenant
select month, sum(roi_usd) as roi_usd
from mv_nsm_usd
where tenant_id = :tenant
group by month
order by month;

-- Adopción por pack (uso + outcome)
select month, pack, adoption_rate
from mv_adoption_pack
where tenant_id = :tenant
order by month;
```

---

**Listo para pegar en Claude Code y desplegar en Netlify.**


# RP9 — Fase 11: Analítica & Reporting
**Fecha:** 2025-08-11

## Decisiones (20/20) — Selección = Recomendación
1) NSM: **ROI mensual (USD)** con **Horas Ahorradas** como métrica operativa.  
2) TTV: **Signup → 1er _outcome_ de negocio** (guardar “A” como leading).  
3) Funnel: **Wizard + 1‑click template → 1ª ejecución + outcome**.  
4) Cohorts: **Semanal (activación) + Mensual (retención)**.  
5) Horas ahorradas: **Template metadata + encuesta baseline + override cliente**.  
6) Stack: **Supabase hoy; BigQuery al escalar**.  
7) Instrumentación: **Frontend + BFF + eventos n8n**.  
8) Latencia: **Mixto** (tiempo real para salud; horario para ROI/finanzas).  
9) Dashboards por audiencia: **Ejecutivo + Operaciones + Finanzas**.  
10) Adopción por pack: **Uso (≥2 flujos/30 ejec/sem) + outcome**.  
11) Alertas/anomalías: **Drop éxito, subida p95, caída horas ahorradas**.  
12) Atribución funnels: **U‑shaped con UTM**.  
13) KPIs base: **TTV, NSM (USD/horas), activación 7d + ops + finanzas**.  
14) Reportes: **Semanal Slack + Mensual PDF/Email**.  
15) Export/Share: **CSV/Excel + PDF + share link + Slack/Teams**.  
16) Data Quality: **Lag + backfill + Data Health por tenant**.  
17) 1ª victoria TTV: **Outcome real**.  
18) Meta TTV: **P50 ≤72h, P75 ≤7d**.  
19) Governance: **metrics.yml versionado + tests en CI**.  
20) Privacidad: **UUIDs sin PII + retención 12–24m por plan**.

---

## Cómo usar este pack
1. Aplica las migraciones SQL en **Supabase** (`infra/supabase/migrations/60_analytics.sql`).  
2. Configura `.env.example` y despliega las **Netlify Functions** (`apps/functions/`).  
3. Programa `analytics-refresh-mv` (cada 30–60 min) y `analytics-anomaly-watch` (cada 5–10 min).  
4. Agrega el módulo de dashboards en el portal (`apps/portal/app/(app)/analytics/*`).

---

## Entregables
- **SQL**: tablas de eventos/outcomes, vistas materializadas de TTV, NSM y adopción.  
- **Functions**: tracking de eventos, KPIs, refresh de MVs, anomalías y reporte mensual PDF.  
- **Portal**: páginas base para Ejecutivo/Operaciones/Finanzas.  
- **Plantillas**: `metrics.yml` (gobernanza) y ejemplos de consultas.  

> Todo es _prod‑ready_ para MVP: seguro (HMAC, rate‑limit), auditable y extensible.
