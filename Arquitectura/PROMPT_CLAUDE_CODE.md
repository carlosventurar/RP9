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
