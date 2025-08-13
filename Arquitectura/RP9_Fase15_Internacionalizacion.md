# RP9 — Fase 15: Internacionalización (LatAm‑first) — Decisiones cerradas

Estas decisiones aplican a **GitHub + Netlify + Supabase + Stripe + n8n en Railway**.

1) Idiomas iniciales del portal → **C**: es‑419 + variantes ligeras por país (es‑MX, es‑AR, es‑CO, es‑CL, es‑PE, es‑DO) y **en‑US** como fallback.
2) Librería i18n en Next.js → **A**: `next-intl` (App Router).
3) Estructura de URL localizadas → **C**: `rp9.io/es-MX/...` (+ alias por país p. ej. `/mx/...`).
4) Detección de país/idioma → **C**: UTM/campaña > IP‑geo (primer hit) > `Accept-Language`; selector manual persiste.
5) Monedas a mostrar → **C**: local + USD como alterna (toggle).
6) Fuente de tipo de cambio → **C**: **Stripe Price Book por país** (sin FX runtime).
7) Redondeo/precio psicológico → **C**: price book por país con redondeos locales (MXN 1,999; CLP 89.900; COP 399.000).
8) Impuestos → **C**: configurable por país (gross B2C, net B2B).
9) Métodos de pago → **C**: Card ahora; locales por fases bajo feature flag.
10) Formato de factura/recibo → **C**: plantillas por país + captura de Tax ID (RFC, RUT, RUC, CUIT, NIT, RNC).
11) Zona horaria UI → **C**: guardar UTC y renderizar: tenant > usuario.
12) Formateo de números/fechas → **C**: Intl nativo + utilidades ligeras (`dayjs`/`date-fns`).
13) Workflow de traducción → **C**: Supabase (`i18n_messages`) + export a JSON en build.
14) Cobertura de idiomas de soporte → **A**: ES (LatAm) + EN básico.
15) Plantillas del marketplace → **B**: ES neutro + ajustes por país (moneda/terminología).
16) Legal (ToS/Privacy/DPA) → **C**: ES neutro + anexos por país + EN.
17) Formularios (dirección/teléfono) → **B**: `libphonenumber` + address schema por país.
18) Mensajería/tono → **A**: Neutro profesional.
19) Analítica multi‑moneda → **B**: normalizar a USD y mostrar local en UI.
20) Feature flags → **B**: flags por país/tenant (métodos de pago, impuestos, plantillas, price book).

---

# Claude Code — Master Prompt (Fase 15 Internacionalización)

Eres un ingeniero full‑stack senior. En el monorepo `rp9/` implementa **Internacionalización (LatAm‑first)** según las *Decisiones cerradas*. Stack: **Next.js (App Router) + next‑intl + Tailwind + shadcn/ui**, **Netlify Functions (TypeScript)**, **Supabase** y **Stripe** (price book por país). El n8n vive en Railway (solo contexto).

## Entregables
1) **Rutas localizadas**: `rp9.io/[locale]/...` con alias `/mx`, `/co`, etc. Middleware con negociación: `UTM > IP‑geo > Accept‑Language > preferencia guardada`.
2) **Price Book**: JSON y tabla Supabase mapeando `{plan, periodicidad, país} -> {price_id Stripe, currency, psychological_price}`. No uses FX runtime.
3) **Checkout**: Function `billing/checkout.ts` que elige el `price_id` por país/plan/período, soporta **toggle USD/local** y agrega impuestos según reglas por país.
4) **UI i18n**: mensajes `es-419`, `en-US` y ligeras variantes (`es-MX`, `es-AR`, `es-CO`, `es-CL`, `es-PE`, `es-DO`). Componentes: `LocaleSwitcher`, `CurrencyToggle`, `PriceTag` (muestra local + “≈ USD”).
5) **Legal y Facturas**: plantillas por país para ToS/Privacy/DPA (MDX) y placeholders de invoice (layout, moneda, formato fecha). Captura de **Tax ID** por país.
6) **Feature Flags por país/tenant**: `country_flags` y `tenant_flags` (método de pago local, impuestos incluidos/excluidos, plantillas visibles).
7) **Traducciones gestionadas**: tabla `i18n_messages(locale, key, value)` en Supabase + export a JSON en build (`scripts/export-i18n.ts`). UI de edición mínima en `/admin/i18n` (role‑gated).
8) **Formateo y validación**: util `format.ts` (Intl) + `phone.ts` (libphonenumber) + `addressSchemas.ts` por país.
9) **Analytics**: util `money.ts` que **normaliza a USD** para reportes y muestra moneda local en UI; almacenamiento de preferencia `currency` a nivel usuario.
10) **Tests**: unit para `pricebook`, `format.ts`, `locale negotiation`; e2e básico de `checkout` feliz.

## Estructura
- `apps/portal/` (Next.js):
  - `middleware.ts`, `lib/i18n/{locales.ts,detect.ts,format.ts}`, `components/{LocaleSwitcher,CurrencyToggle,PriceTag}.tsx`
  - `app/[locale]/layout.tsx`, `app/[locale]/(mkt)/pricing/page.tsx`
  - `messages/{es-419.json,en-US.json,es-MX.json,es-AR.json,es-CO.json,es-CL.json,es-PE.json,es-DO.json}`
  - `content/legal/{tos.mdx, privacy.mdx, dpa.mdx}` + `content/legal/annex-{MX,CO,CL,PE,AR,DO}.mdx`
- `apps/functions/` (Netlify Functions, TS):
  - `geo.ts` (devuelve `{country, locale}` usando header de Netlify/IP)
  - `billing/checkout.ts` (elige `price_id` correcto; respeta impuestos y flags)
- `infra/supabase/migrations/90_i18n.sql` (tablas i18n/pricebook/flags/impuestos)
- `config/pricebook.json` (plantilla de ejemplo con `price_id` de Stripe por país y plan)
- `scripts/export-i18n.ts` (exporta `i18n_messages` → `apps/portal/messages/*.json`)
- `.env.example` con claves y banderas

## Reglas
- **No** consultes FX en runtime. Usa **price book** y muestra “≈ USD” usando los precios USD base.
- Mantén **en‑US** como fallback.
- Soporta **Card** primero; **métodos locales** bajo flag por país.
- Impuestos: `gross` para B2C (por país), `net` para B2B; captura de **Tax ID** en billing.
- Guarda timestamps en **UTC**; renderiza en TZ tenant>usuario.
- Incluye seeds, mocks y tests básicos; no uses datos reales.

---

## Sprints y tareas

**Sprint 1 — i18n básico y rutas**
- [ ] `next-intl` + `middleware.ts` con negociación UTM>IP>AL>preferencia.
- [ ] `messages/*` para `es-419` y `en-US`; alias `/mx`, `/co`, etc.
- [ ] Componentes `LocaleSwitcher`, `CurrencyToggle`, `PriceTag`.

**Sprint 2 — Price Book + Checkout**
- [ ] `infra/supabase/migrations/90_i18n.sql` (pricebook, tax_rules, flags, i18n_messages, user_prefs).
- [ ] `config/pricebook.json` (semilla) y `apps/functions/billing/checkout.ts` (elige `price_id`, impuestos).
- [ ] UI de Pricing con toggle **USD/local** y redondeos psicológicos por país.

**Sprint 3 — Traducciones gestionadas + Legal**
- [ ] `scripts/export-i18n.ts` (Supabase→JSON) + `/admin/i18n` (edición mínima).
- [ ] Plantillas legales MDX (ToS/Privacy/DPA) + anexos por país.
- [ ] Tests unit (pricebook, format) y e2e (checkout feliz).

---

## SQL — Supabase (90_i18n.sql)

```sql
-- País/locale preferido del tenant
create table if not exists tenant_settings (
  tenant_id uuid primary key,
  country char(2) not null default 'MX',
  locale text not null default 'es-MX',
  timezone text not null default 'America/Mexico_City',
  currency char(3) not null default 'MXN',
  flags jsonb default '{}',
  updated_at timestamptz default now()
);

-- Preferencias de usuario
create table if not exists user_prefs (
  user_id uuid primary key,
  locale text default 'es-419',
  currency char(3) default 'LOCAL',
  updated_at timestamptz default now()
);

-- Price book por país/plan/periodicidad
create table if not exists pricebook (
  id bigserial primary key,
  country char(2) not null,
  plan text not null,              -- starter|pro|enterprise|addon
  period text not null,            -- monthly|yearly
  currency char(3) not null,
  stripe_price_id text not null,
  psychological_price numeric,     -- 1999, 399000...
  meta jsonb default '{}',
  unique(country, plan, period)
);

-- Reglas de impuestos por país
create table if not exists tax_rules (
  country char(2) primary key,
  mode text not null,              -- gross|net
  tax_id_label text,               -- RFC|RUT|RUC|CUIT|NIT|RNC
  required boolean default false,
  vat numeric,                     -- opcional
  meta jsonb default '{}'
);

-- Feature flags por país y por tenant
create table if not exists country_flags (
  country char(2) primary key,
  flags jsonb not null             -- { payment_local: true, include_tax: true, templates: ["SAT","DIAN"] }
);

create table if not exists tenant_flags (
  tenant_id uuid primary key,
  flags jsonb not null default '{}'
);

-- Mensajes i18n gestionados en BD
create table if not exists i18n_messages (
  id bigserial primary key,
  locale text not null,
  key text not null,
  value text not null,
  unique(locale, key)
);
```

---

## Variables de entorno (.env.example)

```
# Next.js
NEXT_PUBLIC_DEFAULT_LOCALE=es-419
NEXT_PUBLIC_SUPPORTED_LOCALES=es-419,en-US,es-MX,es-AR,es-CO,es-CL,es-PE,es-DO

# Supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Geo (opcional)
GEO_PROVIDER=netlify
```

---

## Ejemplos clave de implementación

**middleware.ts** (negociación de locale resumida)
```ts
import { NextRequest, NextResponse } from 'next/server'
import { match as matchLocale } from '@formatjs/intl-localematcher'

const SUPPORTED = ['es-419','en-US','es-MX','es-AR','es-CO','es-CL','es-PE','es-DO']
const DEFAULT = 'es-419'

export function middleware(req: NextRequest) {
  const { nextUrl, headers } = req
  const { pathname } = nextUrl

  // 1) UTM/country alias (/mx)
  const alias = pathname.split('/')[1]
  const aliasMap: Record<string,string> = { mx:'es-MX', ar:'es-AR', co:'es-CO', cl:'es-CL', pe:'es-PE', do:'es-DO' }
  if (alias in aliasMap) {
    const url = req.nextUrl.clone()
    url.pathname = `/${aliasMap[alias]}${pathname.replace(`/${alias}`,'')}`
    return NextResponse.redirect(url)
  }

  // 2) Si ya incluye locale, permitir
  const seg = pathname.split('/')[1]
  if (SUPPORTED.includes(seg)) return NextResponse.next()

  // 3) Negotiation: UTM > IP Geo > Accept-Language
  const utmLoc = nextUrl.searchParams.get('utm_loc')
  const ipLoc = headers.get('x-country')
  const al = headers.get('accept-language') || ''

  const candidates = [utmLoc, ipLoc, ...al.split(',')]
  const matched = matchLocale(candidates.filter(Boolean) as string[], SUPPORTED, DEFAULT)

  const url = req.nextUrl.clone()
  url.pathname = `/${matched}${pathname}`
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/((?!_next|favicon.ico|assets).*)'] }
```

**PriceTag.tsx** (muestra local + ≈USD)
```tsx
'use client'
import { useState } from 'react'
export function PriceTag({ local, currency, usdApprox }:{ local:number; currency:string; usdApprox:number }){
  const [showUSD, setShowUSD] = useState(false)
  const fmt = new Intl.NumberFormat(undefined,{ style:'currency', currency })
  const fmtUSD = new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD' })
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-semibold">{fmt.format(local)}</span>
      <button className="text-sm underline" onClick={()=>setShowUSD(s=>!s)}>
        {showUSD ? fmt.format(local) : `≈ ${fmtUSD.format(usdApprox)}`}
      </button>
    </div>
  )
}
```

**Function checkout (resumen de selección de price_id)**
```ts
// apps/functions/billing/checkout.ts (esqueleto)
import { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { getPriceId } from '../../lib/pricebook'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

export const handler: Handler = async (event) => {
  const body = JSON.parse(event.body||'{}')
  const { plan, period, country, currencyPref } = body // currencyPref: 'LOCAL'|'USD'
  const price = await getPriceId({ plan, period, country, currencyPref })

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: price.stripe_price_id, quantity: 1 }],
    success_url: 'https://rp9.io/success',
    cancel_url: 'https://rp9.io/cancel'
  })
  return { statusCode: 200, body: JSON.stringify({ url: session.url }) }
}
```

**messages/es-MX.json** (extracto)
```json
{
  "nav.dashboard": "Tablero",
  "nav.workflows": "Flujos",
  "nav.billing": "Facturación",
  "pricing.starter": "Starter",
  "pricing.pro": "Pro",
  "pricing.enterprise": "Enterprise",
  "pricing.monthly": "Mensual",
  "pricing.yearly": "Anual (-20%)"
}
```

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
