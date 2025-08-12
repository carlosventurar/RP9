# RP9 — Fase 8: Facturación & Finanzas (Stripe)
**Stack:** GitHub · Netlify Functions (TS) · Supabase · Stripe · n8n (Railway: https://primary-production-7f25.up.railway.app/)

## Decisiones (20/20) — Se selecciona la recomendación como respuesta
1) **Modelo principal:** Híbrido plan + metered por uso (B).  
   _Ejemplo:_ Pro incluye 10k ejec./mes; extra a $0.002 c/u.

2) **Métrica facturable:** Nº de ejecuciones (A); evaluar “segundos” para Enterprise después.

3) **Frecuencia de reporte:** Batch cada 5–15 min (B) con retry + idempotencia.

4) **Overage:** Ofrecer paquete extra 1‑click (C) y fallback a cobrar overage automático (B).

5) **Prorrateo upgrades/downgrades:** Prorrateo automático de Stripe (A).

6) **Add‑ons de uso:** One‑off (A) ahora; suscripción mensual adicional (B) cuando haya patrones.

7) **Dunning (cobro fallido):** 3–4 reintentos escalonados + email/WhatsApp (B).

8) **Métodos de pago iniciales:** Tarjeta + transferencia/invoice para Enterprise (B); locales después.

9) **Impuestos/datos fiscales:** Campos mínimos + regla simple por país (B) y migrar a Stripe Tax (A) con volumen.

10) **Fee de implementación:** En self‑serve como fee único (A); en Enterprise vía invoice (B).

11) **Notas de crédito/reembolsos:** Mixto — auto para SLA, manual otros casos (C).

12) **Visibilidad del consumo:** Por workflow y día (B); luego hora + costo (C) en Pro/Ent.

13) **Moneda de facturación:** USD por defecto + precios locales para Enterprise (C).

14) **Cupones/descuentos:** % tiempo limitado con expiración clara (A).

15) **Penalidades SLA:** Créditos en cuenta (A).

16) **Límite blando/duro:** Mixto por plan (C): Starter duro, Pro/Ent blando.

17) **Evidencia para disputas:** Log + hash/firmas de ejecuciones (C).

18) **Portal de facturación:** Mixto: Stripe Customer Portal + vistas propias de uso (C).

19) **Gestión Enterprise:** Contratos con invoice/PO (A) + renovación anual (B) según cliente.

20) **Contabilidad/conciliación:** Sync automático por API (B); export mensual como fallback.

## Prompt maestro para Claude Code (copiar/pegar)
Eres un ingeniero full‑stack senior. En un monorepo `rp9/` crea:

- **apps/portal/**: Next.js (App Router) + Tailwind + shadcn/ui. Páginas `/billing` (consumo, plan, facturas), `/billing/checkout`, `/billing/addons`.
- **apps/functions/** (Netlify Functions TS): 
  - `billing-checkout.ts` (crear sesión de checkout Stripe: plan, anual/mensual, add‑ons; fee de setup opcional),
  - `stripe-webhook.ts` (checkout.session.completed, invoice.paid/failed, customer.subscription.updated, customer.subscription.deleted; idempotencia),
  - `usage-collector.ts` (programada cada 10 min): lee `n8n` → inserta uso en Supabase → crea usage record Stripe (metered item por tenant),
  - `dunning-run.ts` (programada diaria): reintentos 0/24/72/120h, flags de suspensión blanda/dura por plan,
  - `billing-usage.ts` (GET): agrega consumo por workflow/día para el portal.
- **infra/supabase/migrations/**: SQL para `plans`, `subscriptions`, `usage_executions`, `credits`, `invoices_shadow`, `billing_events`, `feature_flags` (si no existe).
- **lib/**: `stripe/client.ts`, `n8n/client.ts`, `usage/aggregate.ts`, `security/hmac.ts`, `utils/idempotency.ts`.
- **netlify.toml**: schedule `usage-collector` cada 10min y `dunning-run` diario 09:00 UTC.

Requisitos:
- Métrica principal: **ejecuciones (success+error)** por tenant y workflow; usar `executionId` como idempotency key en `usage_executions`.
- Soporta **overage** y **bolsas one‑off** (10k/50k/100k). Límite **mixto** por plan (Starter duro, Pro/Ent blando).
- **Stripe Customer Portal** para método de pago/cambio de plan; vistas propias para consumo y costo estimado.
- **Logs probatorios**: hash SHA‑256 por ejecución y link a `executionId` de n8n.
- **País/Impuestos**: campos fiscales mínimos por país; preparar hook para Stripe Tax.
- Tests básicos y README con pasos (Netlify + envs). No usar datos reales.
