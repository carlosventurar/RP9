# RP9 — Fase 16: Legal & Contratos comerciales
**Fecha:** 2025-08-13  
**Stack objetivo:** GitHub · Netlify · Supabase · Stripe · n8n (Railway)

Este documento consolida **las decisiones ya seleccionadas (todas = recomendación)** y entrega un **Claude Code Pack** con prompts, SQL, funciones y archivos base para implementar la capa legal/compliance.

---

## 0) Decisiones cerradas (20/20)
1) **Estructura contractual por plan:** ToS (Starter/Pro) + **MSA/DPA (Enterprise/Pro grande)**.  
2) **Ley/foro:** **CDMX, México** con arbitraje ICC.  
3) **Idioma:** **Bilingüe ES/EN (prevalece ES)**.  
4) **Plazo/renovación:** **Anual** con renovación automática (aviso 30d).  
5) **Terminación anticipada:** **A (30d)** para Starter/Pro; **B (solo por causa)** en Enterprise.  
6) **SLA disponibilidad:** **99.9%** mensual (excluye mantenimientos anunciados).  
7) **Penalidades SLA:** **Créditos % escalonados** (5% / 10% / 20%).  
8) **Respuesta a incidentes:** **P1 4h · P2 8h · P3 siguiente día hábil**.  
9) **Cobertura soporte:** **24/7 solo P1**; P2/P3 horario laboral.  
10) **Rol de datos:** RP9 = **Processor** (cliente = Controller).  
11) **Residencia de datos:** **Configurable por tenant** (mejor esfuerzo).  
12) **Retención logs/ejec.:** **Por plan 7/30/90 días**.  
13) **Retención evidencia fiscal:** **Según regulación país** (SAT/DIAN/RNC...).  
14) **Subprocesadores:** Lista pública + **notificación 30d** (derecho a objeción).  
15) **Seguridad:** **Roadmap SOC2 Type I/II** + controles CIS/OWASP hoy.  
16) **Pruebas seguridad:** **Pentest anual** + SLO de remediación (CRÍTICO ≤7d).  
17) **Propiedad intelectual:** Cliente **dueño de datos/flows**; RP9 de **plataforma/plantillas genéricas**.  
18) **Uso de datos:** **Agregados/anonimizados** para mejora (opt‑out Enterprise).  
19) **Casos de éxito:** **Solo con consentimiento previo** (opción incentivo).  
20) **Limitación de responsabilidad:** **Tope = 12 meses** de fees; **carve‑outs PII/IP = 2×**.

---

## 1) Master Prompt — Claude Code (copiar/pegar tal cual)
> Eres Legal‑Ops/Platform Engineer. En el monorepo `rp9/` crea el **módulo Legal & Compliance** según las decisiones de Fase 16 para el stack **Netlify + Supabase + Stripe + n8n (Railway)**. Entregables:
> 
> **A. Infra (Supabase · SQL · RLS)**
> 1. Migración `infra/supabase/migrations/30_legal.sql` con tablas:
>    - `legal_documents` (plantillas/versiones/idioma/estado/url/si requiere firma).
>    - `legal_acceptances` (ToS/Privacy por usuario/tenant con IP/timestamp).
>    - `contracts` (MSA/DPA/SLA por tenant: estado → draft/sent/signed; URLs PDF).
>    - `subprocessors` y `subprocessor_subscriptions` (notificación 30 días).
>    - `incidents`, `maintenances`, `sla_metrics`, `sla_credits`.
>    - `retention_policies` (logs=7/30/90; evidence_years por país).
>    - RLS por tenant y vistas materializadas para reportes.
> 
> **B. Functions (Netlify · TypeScript)**
> 2. `legal-generate.ts` ⇒ compone documentos desde **MD/handlebars** (`templates/legal/*`) con variables: {{ company_name, country, plan, juris='CDMX', lang='es', sla='99.9%', penalties=[5,10,20], opt_out=false }}. Devuelve **PDF/HTML** (usar md→pdf lib o HTML → PDF headless).
> 3. `legal-accept.ts` (POST) ⇒ registra aceptación de **ToS/Privacy** (bilingüe), guarda IP/UA y version.  
> 4. `contracts-create.ts` ⇒ prepara **MSA/DPA** por tenant (rellena variables, guarda draft).  
> 5. `contracts-sign-webhook.ts` ⇒ webhook de firma (placeholder, simular DocuSign/Zoho) y marca `signed_at`.  
> 6. `subprocessors-manage.ts` ⇒ CRUD + `notify` que envía email a suscriptores (30 días antes).  
> 7. `sla-credit-calc.ts` (scheduled) ⇒ calcula uptime mensual, aplica **créditos** (5/10/20%) y crea **memo** en Supabase; si usa Stripe, genera **coupon/credit note** (simulado).  
> 8. `incidents-rca.ts` ⇒ endpoint para subir **RCA** (URL) y cerrar incidente.  
> 
> **C. Portal (Next.js · App Router)**
> 9. Páginas: `/legal/tos`, `/legal/privacy`, `/legal/subprocessors`, `/legal/contracts`, `/legal/status`.  
> 10. Componentes: `LegalViewer`, `DocVersions`, `AcceptButton`, `SubprocessorsTable`, `SLACreditsTable`.  
> 11. Al registrarse, forzar **ToS acceptance** (banner modal, bilingüe).  
> 
> **D. Plantillas (bilingüe ES/EN)** en `templates/legal/`:
> 12. `tos_es_en.md`, `privacy_es_en.md`, `msa_es_en.md`, `dpa_es_en.md`, `sla_es_en.md`, `security_overview.md`. Variables handlebars `{{like_this}}`.  
>    - SLA: 99.9% y **créditos escalonados** (99.0–99.5 = 5%; 98.0–99.0 = 10%; <98% = 20%).  
>    - Terminación: Starter/Pro (30d) · Enterprise (por causa).  
>    - IP: cliente datos/flows; RP9 plataforma/plantillas.  
>    - Datos: uso **agregado/anonimizado** para mejora; **opt‑out Enterprise**.  
> 
> **E. Seguridad**
> 13. Policies: `Incident Response`, `Vulnerability Mgmt` (pentest anual; CRIT≤7d, HIGH≤14d).  
> 14. Endpoints con **rate‑limit, HMAC opcional**, logs estructurados.  
> 
> **F. No‑funcionales**
> 15. Validación `zod`, tests básicos, README y `.env.example`. **Sin datos reales**.
> 
> **Variables env:** `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, HMAC_SECRET, DOCS_BASE_URL, SIGN_WEBHOOK_SECRET`.
> 
> **Entrega estructurada y productiva**: código TS, carpetas, SQL y MD listos para commit.

---

## 2) Estructura sugerida
```
rp9/
  apps/portal/app/legal/(tos|privacy|subprocessors|contracts|status)/page.tsx
  apps/functions/{legal-generate.ts,legal-accept.ts,contracts-create.ts,contracts-sign-webhook.ts,
                  subprocessors-manage.ts,sla-credit-calc.ts,incidents-rca.ts}
  infra/supabase/migrations/30_legal.sql
  templates/legal/{tos_es_en.md,privacy_es_en.md,msa_es_en.md,dpa_es_en.md,sla_es_en.md,security_overview.md}
  content/legal/README.md
```

---

## 3) SQL — `infra/supabase/migrations/30_legal.sql` (extracto clave)
Incluido completo en el ZIP. Crea tablas **legal_documents, legal_acceptances, contracts, subprocessors, subprocessor_subscriptions, incidents, maintenances, sla_metrics, sla_credits, retention_policies** y políticas **RLS** por tenant/usuario.

---

## 4) Endpoints/Functions — especificaciones rápidas
- **POST** `/.netlify/functions/legal-accept` → body: `{{"type":"tos","version":"2025-01","tenant_id":"...","user_id":"...","lang":"es"}}` → 200/409.  
- **POST** `/.netlify/functions/contracts-create` → genera MSA/DPA desde plantillas y retorna `contract_id` + URL.  
- **POST** `/.netlify/functions/sla-credit-calc` (cron mensual) → computa uptime (de `sla_metrics`) y crea `sla_credits`.  
- **POST** `/.netlify/functions/subprocessors-manage` → `{{"action":"notify"}}` envía emails a subscriptores (preaviso 30d).  

---

## 5) Sprints & Tasks
**Sprint L‑1 (Infra & ToS)**  
- SQL + RLS + seeds.  
- Páginas `/legal/tos` y `/legal/privacy` + `legal-accept`.  
- Registro de aceptaciones por usuario/tenant.

**Sprint L‑2 (Contracts & Subprocesadores)**  
- `contracts-create` + plantilla **MSA/DPA** y flujo de firma (webhook simulado).  
- CRUD subprocesadores + **notify 30d** y página pública.

**Sprint L‑3 (SLA & Incidentes)**  
- `sla_metrics` + `sla-credit-calc` (créditos 5/10/20%).  
- `/legal/status` con incidentes/mantenimientos; subida de **RCA**.

**Sprint L‑4 (Hardening & QA)**  
- Pentest baseline (scripts) + SLOs de fix.  
- Tests, zod, rate‑limit/HMAC en endpoints, README.

---

## 6) Criterios de Aceptación
- Bloqueo de onboarding hasta aceptar **ToS** (persistido por usuario/tenant).  
- Generación de **MSA/DPA** con variables; estado pasa a `signed` vía webhook simulado.  
- Página pública de **Subprocesadores** con suscripción y notificación **30 días antes** de cambios.  
- Cálculo mensual de **créditos SLA** y registro auditable.  
- **RLS** aplicada y datos visibles solo a su tenant.  

---

## 7) Nota legal
Este material es técnico, **no constituye asesoría legal**. Usa estas plantillas como base y revisa con tu abogado local antes de cerrar contratos.
