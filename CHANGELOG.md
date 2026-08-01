# Changelog — Agente Virtual IA

Todo cambio que llega a producción se anota aquí. Lo más reciente arriba.
Versiones según [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Nuevo
- **El cliente entra a `/novedades` y ve qué cambió en cada versión.** Cada entrada lleva su
  fecha, así sabe desde cuándo tiene disponible lo que está leyendo.
  <!-- tec: src/lib/changelog.ts (parser), src/lib/changelog-server.ts (lectura+cache), src/app/[locale]/novedades/page.tsx · lee este mismo CHANGELOG.md con fs desde process.cwd() · outputFileTracingIncludes en next.config.js lo mete en el bundle de la funcion · las lineas tec: se eliminan ANTES de pasar por marked · rotulos en i18n key "changelog" -->

## [0.1.0] — 2026-08-01

### Nuevo
- **El equipo automatiza su trabajo repetitivo sin escribir código.** Arma el flujo desde el
  navegador o arranca de una plantilla, y sigue cada ejecución en el panel. Paga su plan en línea
  y en la moneda de su país, en ocho países de la región.
  <!-- tec: Next.js 15 App Router + React 19 · Supabase (auth, datos, RLS) · Stripe (billing, checkout) · n8n via proxy en /api/n8n · Netlify Functions · i18n con next-intl, locales en src/lib/i18n/config.ts · middleware.ts negocia locale por UTM > geo-IP > Accept-Language > cookie -->

## Antes de este changelog

El trabajo anterior al 2026-08-01 no está desglosado aquí. Ver `git log v0.1.0` para el detalle
de commits.
