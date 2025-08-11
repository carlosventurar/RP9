# RP9 — Fase 14: AI Assistant & Diferenciadores
**Scope:** Generar flujos, explicar errores, profiler de performance. Stack: GitHub + Netlify + Supabase + Stripe + n8n (Railway).

## Decisiones finales (seleccionadas = recomendación)
1) Modelos: **Multi‑proveedor con fallback + BYOK** (prioridad RP9 key, si hay BYOK usarla primero).
2) Ejecución IA: **Backend RP9 (Fastify/Node en VPS)** (control/seguridad + menor cold start).
3) UX: **Botones contextuales “Fix con IA” + Command Palette** (chat secundario).
4) Generación de flujos: **Blueprint semántico → traductor a JSON n8n** + wizard corto.
5) Validación: **Esquema + Dry‑run en sandbox** antes de guardar.
6) Explicación de errores: **Root‑cause + nodo afectado + botón “Aplicar fix” (PR)**.
7) Profiler: **Real (ejecuciones) + Simulación sintética** (tiempos por nodo, p95).
8) Optimización: **Auto‑aplicar con aprobación** (1‑click, diff y rollback).
9) Privacidad: **Redacción PII + no enviar payload real**; **BYOK opt‑in**.
10) Contexto: **Few‑shot por vertical + Retrieval por tenant** (docs/flows previos).
11) Telemetría IA: **Uso + tasa de aceptación** (anónimo, sin PII).
12) Presentación: **Diff JSON + vista visual** y opción clonar como nuevo flujo.
13) Costos IA: **Presupuesto/tenant + rate‑limit/usuario + caché** de prompts.
14) Idioma: **Auto‑detect con prioridad ES** (LatAm‑first).
15) Acceso: **Feature flags por plan + RBAC** (auto‑fix solo editor/admin).
16) Playground IA: **Habilitado** por tenant (RBAC).
17) Versionado: **Guardar PR AI** (metadatos completos) + revisión obligatoria en Enterprise.
18) Evaluación: **Benchmark semanal + A/B seguro** de prompts.
19) Latencia: **Streaming parcial + paralelizar sugerencias**.
20) Diferenciadores: **“Arreglar 1‑click” ahora**, luego **Profiler**, después **Generador multi‑vertical**.

## Arquitectura (resumen)
- **AI Service (Fastify/Node)** en VPS (junto al BFF), cola opcional. Endpoints `/ai/*` con token RP9 y BYOK por header.
- **Providers**: OpenAI/Anthropic drivers con **fallback**; caché por hash de prompt+contexto.
- **Redactor PII**: email/teléfono/CC/ID → tokens; logs anonimizados.
- **Supabase**: tablas `ai_events`, `ai_versions`, `ai_budgets`, `ai_cache`, `ai_models`, `ai_prompts`.
- **Frontend**: botones “Fix con IA”, DiffViewer, Profiler panel, Command Palette.
- **Stripe**: control de presupuesto IA (créditos/mes) y upsell “Paquete IA”.

## API interna (/ai)
- `POST /ai/generate-workflow` → {"prompt","context"} → blueprint + JSON n8n + requisitos.
- `POST /ai/debug` → {"workflow","errorLog"} → root‑cause + fixes + opcional autoFix (diff).
- `POST /ai/optimize` → {"workflow","metrics"} → sugerencias + diff (batch/cache/retry).
- `POST /ai/profile` → {"workflow"|"executionIds"} → tiempos por nodo (p50/p95), cuellos.
- `POST /ai/apply-fix` → {"workflow","diff","meta"} → nueva versión + registro en `ai_versions`.
- `GET /ai/budget` → presupuesto restante/tenant; `POST /ai/feedback` registra aceptación.

## Plan por sprints
**Sprint 1 – Servicio IA + Redactor + Fallback**
- Fastify + providers (OpenAI/Anthropic) + BYOK + caché + costos estimados.
- Endpoints: generate‑workflow, debug, optimize; Supabase `ai_events`/`ai_budgets`/`ai_cache`.

**Sprint 2 – Diff + Versionado + UI acciones**
- JSON diff + apply‑fix; tabla `ai_versions`; componentes DiffViewer y FixPanel (Next.js).

**Sprint 3 – Profiler + Validación + Sandbox**
- `profile` real (ejecuciones) + sintético; dry‑run en sandbox antes de guardar.

**Sprint 4 – Evaluación & A/B + Telemetría**
- `ai_prompts` versionadas, benchmark semanal, A/B seguro; dashboard aceptación.

## .env.example (extracto)
```
AI_PORT=8090
AI_TOKEN=__SET_ME__
# Proveedores
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
# Capa BYOK (si el cliente quiere su key)
ALLOW_BYOK=true
# Caché
AI_CACHE_TTL_SECONDS=86400
```

## Notas
- Las Netlify Functions invocan al **AI Service**; no ejecutan LLMs directo.
- Para n8n, el servicio genera **JSON válido** y opcional **PR AI** con diff y rollback seguro.
