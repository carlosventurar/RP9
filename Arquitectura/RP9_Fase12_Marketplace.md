
# RP9 — Fase 12: Marketplace & Plantillas Monetizadas
**Fecha:** 2025-08-11

Esta fase habilita un **marketplace white‑label** de plantillas/packs con **pricing, revenue share, curaduría y adopción por pack**. Stack: **GitHub + Netlify (Functions) + Supabase + Stripe/Stripe Connect + n8n en Railway** (`https://primary-production-7f25.up.railway.app`).

---

## Decisiones (20/20) — Selección = Recomendación
1) Alcance MVP: **B** (RP9 + creators curados).  
2) Unidad de catálogo: **B** (packs de 3–5 workflows).  
3) Precio por ítem: **C** (free/one‑off + add‑on mensual).  
4) Tiers: **C** (Low/Mid/Pro + Enterprise).  
5) Monedas: **B** (USD + MXN/COP/CLP).  
6) Revenue share: **B** (70/30).  
7) Curaduría: **C** (pre‑aprobación; fast‑track para confiables).  
8) Requisitos calidad: **C** (README+mock+tests+linter).  
9) Seguridad: **C** (sanitizador + secret scan + bloqueo).  
10) Updates: **B** (auto minor; major con consentimiento).  
11) Preview: **C** (vista + sandbox 1‑click con X ejecuciones).  
12) Devoluciones: **C** (política combinada con crédito).  
13) Soporte: **C** (RP9 packs; terceros creator).  
14) Promoción: **B** (algoritmo + curador).  
15) Métricas para creators: **C** (vistas/installs/retención/ingresos).  
16) Licencia/protección: **C** (EULA + trazabilidad + controles suaves).  
17) Adopción por pack (ranking/payout): **C** (ejecuciones + outcome ponderado 60/40).  
18) Bundles/descuentos: **C** (descuento + suscripción pack, mostrar “mejor opción”).  
19) Payouts creators: **C** (mensual + KYC/retenciones por país).  
20) Governance catálogo: **C** (taxonomía + tags + lint CI).

---

## Cómo usar este pack
1. Ejecuta **migración SQL** en Supabase: `infra/supabase/migrations/70_marketplace.sql`.  
2. Configura **.env** y deploya **Netlify Functions** en `apps/functions/marketplace/*`.  
3. Publica el **frontend** del marketplace: `apps/portal/app/(app)/templates/*`.  
4. Activa **Stripe Connect** (Standard) y webhooks (`stripe-webhook-marketplace`).  
5. Habilita sanidad de JSON de n8n con `scripts/sanitize-workflow.ts` en CI.

---

## Entregables
- **SQL** (catálogo, órdenes, payouts, ratings, curation, adoption por pack).  
- **Functions**: listar/preview/instalar/comprar, webhooks Stripe, onboarding de creators, KPIs.  
- **Frontend**: Marketplace (grid, detail, pack, creator center).  
- **Gobernanza**: `marketplace.yml` (revenue split, tiers, linter de metadata).  
- **Utilidades**: sanitizador de workflows, validador de metadata, ejemplos de templates.
