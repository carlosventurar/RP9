# RP9 — Fase 8: Facturación & Finanzas (Stripe)

**Estado:** confirmado (tomamos todas las recomendaciones como respuesta).  
**Fecha:** 2025-08-12

## Decisiones clave
- **Modelo**: planes Starter/Pro/Enterprise + **metered por ejecuciones** y **paquetes extra** (10k/50k/100k).
- **Cobro**: Stripe (checkout self‑serve Starter/Pro, Enterprise asistido/PO). Impuestos por país.
- **Enforcement**: alertas 80%/100%, 48h de gracia, **auto‑upgrade** si 2 meses seguidos superan límite.
- **Dunning**: 3 reintentos + email/WhatsApp opcional. Registro de eventos en Supabase.
- **Uso**: colector que lee `executions` de n8n (Railway) y sube usage (Stripe) + guarda evidencia hash.
- **UI**: página /billing con plan, consumo, overage y compras de paquetes.

## Entregables
- **SQL Supabase**: `30_billing.sql` (planes, suscripciones, usage, add‑ons, eventos, vistas).
- **Netlify Functions (TS)**: checkout, webhook Stripe, colector de uso, enforcement, dunning.
- **Portal**: `/billing` + componentes (`PlanCard`, `UsageChart`, `OverageBanner`).
- **Guías**: `.env.example` y `scripts/stripe_seed.md` para crear productos/precios en Stripe.

## Variables (.env.example)
```
# n8n
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__

# Supabase
SUPABASE_URL=__SETME__
SUPABASE_SERVICE_ROLE_KEY=__SETME__
SUPABASE_ANON_KEY=__SETME__

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx_m
STRIPE_PRICE_STARTER_YEARLY=price_xxx_y
STRIPE_PRICE_PRO=price_xxx_m
STRIPE_PRICE_PRO_YEARLY=price_xxx_y
STRIPE_PRICE_ENTERPRISE=price_xxx_custom
STRIPE_PRICE_METERED_EXEC=price_metered_executions
STRIPE_PRICE_PACK_10K=price_pack_10k
STRIPE_PRICE_PACK_50K=price_pack_50k
STRIPE_PRICE_PACK_100K=price_pack_100k
```

## Pasos rápidos
1) Ejecuta la migración **30_billing.sql** en Supabase.  
2) Despliega Netlify Functions de este pack.  
3) Crea productos/precios con `scripts/stripe_seed.md`.  
4) Publica la página **/billing** en tu portal.  
5) Programa `usage-collector` cada 5–10 min.
