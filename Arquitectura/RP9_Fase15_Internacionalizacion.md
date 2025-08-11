# RP9 — Fase 15: Internacionalización (LatAm-first) · Idioma & Moneda
**Contexto:** Portal RP9 sobre n8n con foco LatAm. Se implementa i18n, moneda local con USD alterna, plantillas fiscales por país, price-books en Stripe y feature flags por país/tenant.

## 0) Decisiones (aceptadas)
1) es-419 + variantes por país + en-US fallback
2) next-intl (App Router)
3) Rutas /[locale]/... (alias por país)
4) Detección: UTM > IP > navegador
5) Moneda local + USD toggle
6) Stripe price books por país (sin FX runtime)
7) Redondeo por país
8) Precios bruto/net configurable por país
9) Card ahora; locales por fases con flags
10) Factura por país + RFC/RUT/RUC/CUIT/NIT/RNC
11) Guardar UTC y render tenant>usuario
12) Intl + utilidades ligeras
13) i18n_messages en Supabase + export en build
14) ES LatAm + EN básico
15) ES neutro + ajustes por país
16) Legal ES + anexos por país + EN
17) Validaciones teléfono/dirección por país
18) Tono neutro profesional
19) Analítica normalizada a USD (UI local)
20) Feature flags por país/tenant

## Objetivos
- DX simple con `next-intl` y catálogos en Supabase.
- Venta en moneda local con toggle USD.
- Cumplimiento fiscal por país (tax ID, formato).
- Analítica a USD; UI en local.

## Entregables incluidos
- SQL: `locales`, `i18n_messages`, `country_configs`, `price_books`, `tenant_settings`.
- Middleware Next.js (UTM/IP/Accept-Language) y rutas `/[locale]/...`.
- Utils de moneda/fecha (`Intl`) y toggle USD.
- Componentes: `LocaleSwitcher`, `CurrencyToggle`, `TaxIdField`.
- Function Netlify `pricebook-lookup.ts` + `config/priceBooks.json`.
- Mensajes base: `es-419`, `es-MX`, `es-AR`, `en-US`.
- Plantillas legales ES/EN (placeholders).

## Sprints (3 semanas)
S1 i18n + URL + mensajes • S2 Moneda + Price books + Facturas • S3 Métodos locales + Analítica (USD)

## Criterios de aceptación
- Navegación `/es-MX/*` y `/en-US/*` con fallback `es-419`.
- Pricing muestra local y toggle USD; checkout usa `price_id` correcto (price book).
- Factura muestra tax ID local; respeta bruto/neto.
- KPIs devuelven USD + local por tenant.

## Env vars
```
NEXT_LOCALES=es-419,es-MX,es-AR,es-CO,es-CL,es-PE,es-DO,en-US
DEFAULT_LOCALE=es-419
STRIPE_SECRET_KEY=sk_test_xxx
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```
