# RP9 — Fase Onboarding & TTV (Wizard • Plantillas • Checklist)

**Fecha:** 2025-08-11T01:32:13.344722Z

Este paquete implementa el **Onboarding orientado a Time-to-Value** con wizard progresivo, instalación 1-click de **2 plantillas** (mock + real), **checklist** con gating mínimo, **notificaciones** primeros 7–14 días, **catálogo 8–12** ordenado por país, definición de **activación por resultado de negocio** y **health score** ponderado por outcomes.

---

## 1) Decisiones clave
- Primer valor: **Resultado de negocio** (p.ej., ticket creado o factura validada).
- Wizard: **Progresivo** (pide lo justo; profundiza si hay avance).
- Integraciones iniciales: **Conectar 1** (recomendar 2ª si hay alta intención).
- Vertical visible: **CC & Finanzas** (preselección por copy/UTM/geo).
- Resultado del wizard: instalar **2 plantillas** → **mock (ejecuta ya)** + **real (lista)**.
- Catálogo inicial: **8–12** plantillas.
- Instalación: **1‑click** con autoconfig si hay OAuth.
- Datos de prueba: **reales limitados**; si no hay permisos → **sandbox**.
- Checklist: **lateral + página** con **gating mínimo** en credenciales/permisos.
- Gamificación: **progreso + badges**.
- Notificaciones: **in‑app + email/WA** durante 7–14 días.
- Favoritos por país: **mismo catálogo, orden contextual** (MX/CO/AR/CL/PE/DO).
- Activación: **outcome + 5 ejecuciones**.
- Health score: **50% outcome / 30% integraciones / 20% uso**.
- Ayuda en producto: **tooltips + micro‑videos** (30–60s).
- Escalamiento humano: **botón agenda 15 min** (Calendly).
- CSAT WhatsApp (CC): **opcional** en wizard.
- Evidencia & trazabilidad: **logs n8n + hash SHA‑256 en Supabase Storage**.
- Modo: **C → B → A** vía feature flag `ONB_MODE`.

---

## 2) Entregables incluidos
- **SQL Supabase** `infra/supabase/30_onboarding.sql` (tablas + índices + RLS esqueleto).
- **Wizard** `apps/portal/app/(app)/onboarding/wizard/page.tsx` (progresivo, instala mock+real).
- **Checklist** `apps/portal/app/(app)/onboarding/checklist/page.tsx` + **catálogo** `components/onboarding/TemplateCatalog.tsx`.
- **Netlify Functions (TS)**: `onboarding/save-progress.ts`, `onboarding/templates-install.ts`, `onboarding/notify-digest.ts`, `onboarding/geo.ts`, `evidence/upload.ts`.
- **.env.example** con BFF/n8n/Supabase/Calendly/WA.
- **README_Onboarding.md** con pasos y criterios de aceptación.

---

## 3) Prompt maestro para Claude Code (breve)
Eres un ingeniero full‑stack senior. En el monorepo `rp9/` (Node 18) implementa el **Onboarding & TTV** con **Next.js App Router + Tailwind + shadcn/ui**, **Netlify Functions (TS)**, **Supabase** (SQL + RLS), **Stripe**, y **n8n en Railway** (`N8N_BASE_URL=https://primary-production-7f25.up.railway.app`). Requisitos: wizard progresivo; instalar **2 plantillas** (mock ejecuta, real lista); gating mínimo (credenciales); **activación** por **outcome + 5 ejecuciones**; **health score** = 50/30/20; notificaciones 7–14 días (in‑app + email/WA); catálogo **8–12** con **orden por país**. Entrega vistas, functions, SQL, feature flag `ONB_MODE`, gamificación, CSAT WA opcional, tests y README.

---

## 4) Backlog por Sprints
**Sprint ONB‑1**: Wizard (vertical + integraciones + plantillas mock/real 1‑click), function `templates-install`, SQL catálogo.  
**Sprint ONB‑2**: Checklist (gating mínimo), activación (outcome + 5), health score y digest 7–14 días.  
**Sprint ONB‑3**: Evidencia (Storage + SHA‑256), orden por país, feature flag C→B→A, documentación y tests.

---

## 5) Variables de entorno
```
BFF_BASE_URL=https://api.rp9.io
BFF_TENANT=default
BFF_TOKEN=__SETME__

N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__

SUPABASE_URL=__SETME__
SUPABASE_ANON_KEY=__SETME__
SUPABASE_SERVICE_ROLE_KEY=__SETME__
SUPABASE_BUCKET_EVIDENCE=evidence

ONB_MODE=assisted
CALENDLY_URL=https://calendly.com/tu-enlace/15min

WA_PROVIDER_TOKEN=__SETME__
WA_TEMPLATE_ID=csat_template
```
