
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
