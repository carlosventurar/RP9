
# Claude Code Pack — Fase 3: GTM & Ventas (RP9)
**Stack:** GitHub · Netlify · Supabase · Stripe · HubSpot/Freshsales · n8n (Railway)
**Objetivo 60 días:** 1–2 lighthouses + 4–6 betas + US$5k MRR

---

## 0) Resumen de decisiones
- Outbound: LinkedIn + email multi‑touch.
- Oferta lighthouse: −25% 6 meses por caso público (+ opcional performance rebate).
- Piloto: 30 días pagado y descontable.
- Buyer CC: Head of Operations; Buyer Finanzas: CFO (Accounting champion).
- Calificación: MEDDIC‑lite.
- Mensaje por vertical: CC = SLA/velocidad; Finanzas = compliance. Si único: ROI horas.
- Demo: tenant demo dedicado con data ficticia.
- Activos: one‑pager + case study deck + calculadora ROI.
- Pricing web: híbrido (Starter público + Pro/Ent guiado).
- Contratos: ToS (Starter) y MSA/DPA (Pro/Ent).
- Partners: Referral ahora; Implementación después; tiers Silver/Gold.
- Geos: MX/CO/CL/PE/AR/DO (copy local).
- Eventos: Webinars co‑host + Office Hours.
- Motion: SDR part‑time externo; founder‑led habilitado.
- CRM: HubSpot (adapter Freshsales opcional).
- Lead scoring: reglas simples; luego PQL.
- Handoff: Kickoff + success plan + onboarding automatizado.

---

## 1) Master Prompt para Claude Code
Copia y pega en Claude Code:
```
Eres Growth/RevOps Engineer. En el monorepo `rp9/` crea el stack GTM completo para RP9 según las decisiones de Fase 3. Usa GitHub + Netlify + Supabase + Stripe + HubSpot (y Freshsales/Freshdesk como alternativa mediante adapter). Entregables:
A) Apps & Contenido
  1) apps/portal/app/(mkt)/{pricing,roi,lighthouse,partners,webinars} (Next.js App Router, Tailwind, shadcn/ui, i18n es‑MX/CO/CL/PE/AR/DO).
  2) Calculadora ROI (eventos/mes × min ahorrados × costo/hora) con CTA a checkout/piloto.
  3) Demo scripts (3 guiones) + botón para pedir tenant demo.
  4) One‑pager y Case Study Deck en content/ como MDX + export a PDF.
B) Automatización de Leads (Netlify Functions TS)
  5) functions/leads-submit.ts → Contact + Company + Deal en HubSpot (o Freshsales adapter), pipeline "Pilot 30d".
  6) functions/leads-webhook.ts → persistir eventos en Supabase y notificar.
  7) functions/demo-tenant.ts → crea tenant demo (flag) y envía credenciales temporales.
C) Sales Ops
  8) Secuencias LinkedIn + Email (5 toques/14 días) para CC y Finanzas, multipaís en content/sequences/*.yaml.
  9) Email templates y WhatsApp follow‑ups opcionales.
  10) MEDDIC‑lite checklist en content/playbooks/meddic.md + form /mkt/deal-qualify.
D) Partners & Webinars
  11) Página Partners (tiers Silver/Gold) + formulario → CRM.
  12) Página Webinars (co‑host) + Office Hours semanales; registrar inscripciones.
E) Analytics GTM
  13) Tablas Supabase: leads, crm_events, webinars_registrations, roi_events.
  14) Endpoint GET /api/gtm/kpis para dashboards (SQL agregados) y panel en portal.
Requisitos no‑funcionales: zod, rate‑limit, HMAC opcional, honeypot, logs estructurados, tests, README y .env.example.
Adapters CRM: lib/crm/hubspot.ts (token app privada) y lib/crm/freshsales.ts (domain + token). Interface: upsertContact, upsertCompany, createOrUpdateDeal, emitEvent.
No uses datos reales; seeds/mocks incluidos.
```
---

## 2) Estructura de carpetas (GTM)
```
rp9/
  apps/
    portal/
      app/(mkt)/pricing/page.tsx
      app/(mkt)/roi/page.tsx
      app/(mkt)/lighthouse/page.tsx
      app/(mkt)/partners/page.tsx
      app/(mkt)/webinars/page.tsx
      components/mkt/ROIForm.tsx
      components/mkt/LeadForm.tsx
      components/mkt/PartnerForm.tsx
    functions/
      leads-submit.ts
      leads-webhook.ts
      demo-tenant.ts
      gtm-kpis.ts
  lib/
    crm/hubspot.ts
    crm/freshsales.ts
    email/templates/
  content/
    sequences/
      cc-outbound.yaml
      fin-outbound.yaml
    playbooks/meddic.md
    onepager.mdx
    case-study-deck.mdx
  infra/supabase/migrations/
    20_gtm.sql
```

---

## 3) SQL — Supabase (20_gtm.sql)
(El archivo completo está dentro del .zip)
```sql
create table if not exists leads (...);
create table if not exists crm_events (...);
create table if not exists webinars_registrations (...);
create table if not exists roi_events (...);
-- índices
```

---

## 4) Netlify Functions — especificaciones
- `leads-submit.ts` (POST): valida, inserta en `leads`, upsert Contact/Company/Deal (pipeline "Pilot 30d"), devuelve `dealUrl`.
- `leads-webhook.ts` (POST): firma, eventos stage, guarda `crm_events`, si `Pilot Approved` → `demo-tenant.ts`.
- `demo-tenant.ts` (POST/internal): crea tenant demo vía orchestrator, envía credenciales y checklist.
- `gtm-kpis.ts` (GET): KPIs de GTM para dashboard.

---

## 5) Adapters CRM (TypeScript)
Interface común en `lib/crm/types.ts` con: `upsertContact`, `upsertCompany`, `createOrUpdateDeal`.
Implementaciones: `hubspot.ts` y `freshsales.ts` (selección por `CRM_PROVIDER`).

---

## 6) Sequences (YAML) — LinkedIn + Email (5 toques/14 días)
Archivos `content/sequences/cc-outbound.yaml` y `fin-outbound.yaml` incluidos en el .zip.

---

## 7) UI Extractos
- `LeadForm.tsx` y `ROIForm.tsx` incluidos en el .zip (listos para pegar).

---

## 8) Backlog por Sprints (4 semanas)
- **GTM‑1:** Sequences + LeadForm + Pricing/ROI con CTA a Piloto.
- **GTM‑2:** Demo tenant + One‑pager + Deck + `leads-webhook` + KPIs.
- **GTM‑3:** Partners + Webinars + Office Hours.
- **GTM‑4:** Lead scoring reglas + A/B de outreach + automatizar `demo-tenant` al aprobar Pilot.

---

## 9) Criterios de aceptación (60 días)
- 1–2 lighthouses con caso público y métricas.
- 4–6 betas activos; MRR ≥ US$5k en Stripe.
- Pipeline completo con KPIs en portal.
- Demo tenant funcional + ROI en web.
- ≥2 webinars co‑host y ≥10 leads referidos.
