# RP9 — Fase 14: AI Assistant & Diferenciadores (Decisiones Cerradas)

Estas son las **respuestas seleccionadas** (tomamos la **recomendación** en cada pregunta) y el alcance del paquete para Claude Code.

## Decisiones clave

1) **Estrategia de modelos (LLM)**: **B + C** → Multi‑proveedor con fallback (OpenAI↔Anthropic) y **BYOK** (si el cliente sube su key, se usa primero).
2) **Dónde corre el servicio de IA**: **B** → Backend RP9 (Fastify/Node) para controlar seguridad, latencia y colas.
3) **Superficie de UX**: **C + B** → Botones contextuales “Fix con IA” + Command Palette; chat solo complementario.
4) **Cómo generar flujos**: **B + C** → Blueprint semántico → traductor a JSON n8n, con wizard opcional por pasos.
5) **Validación antes de guardar**: **C** → Validación de esquema/credenciales + **dry‑run** en sandbox (no producción).
6) **Explicación de errores**: **A + C** → Diagnóstico con root‑cause + “Aplicar fix” como PR versionado (diff, rollback).
7) **Profiler de performance**: **C** → Métricas reales + simulación sintética para laboratorio.
8) **Optimización automática**: **B** → Auto‑aplicar con aprobación 1‑click (diff + rollback).
9) **Privacidad/seguridad de prompts**: **A + B** (C para Ent) → Redactar PII y usar solo esquemas/ejemplos; BYOK opt‑in.
10) **Contexto de dominio**: **A + B** → Few‑shot por vertical + Retrieval de docs/flows previos del tenant.
11) **Telemetría de IA**: **A** → Uso y tasa de aceptación (anónimo, sin PII).
12) **Cómo mostrar resultados**: **A + C** → Diff JSON + vista visual; opción “copiar a flujo nuevo”.
13) **Control de costos**: **A + B + C** → Presupuesto mensual por tenant + rate limit por usuario + caché de prompts.
14) **Idioma**: **C** → Auto‑detect con preferencia ES (LatAm‑first).
15) **Permisos y planes**: **C** → Flags por plan + RBAC por rol (p.ej., Auto‑fix solo admin/editor).
16) **Playground**: **A** → Pestaña “Experimentos” por tenant (RBAC).
17) **Versionado de cambios por IA**: **A (+C para Ent)** → PR AI con metadatos; revisión obligatoria en Enterprise.
18) **Evaluación de prompts**: **A + C** → Benchmark semanal sintético + A/B seguro en producción.
19) **Latencia percibida**: **B + C** → Streaming parcial y paralelizar sugerencias de nodos críticos.
20) **Diferenciadores**: **B ahora, C siguiente, A Q2** → priorizar **Explicador de errores con 1‑click fix**, luego **Profiler**.

## Master Prompt — Claude Code (copiar/pegar)

Eres **Tech Lead AI** en RP9. Entrega un **paquete de servicio de IA** en un monorepo `rp9/` con:
- `apps/ai-service/` (Fastify + TypeScript) corriendo en VPS/BFF.
- `apps/portal/` componentes UI: **Command Palette** y **FixWithAI**.
- `infra/supabase/migrations/50_ai.sql` (tablas: `ai_usage`, `ai_prs`, `ai_prompts`, `ai_budgets`, `ai_flags`).
- `netlify/functions/ai-bridge.ts` (proxy opcional del portal a `ai-service`).

### Requisitos funcionales
1) **Model Router** multi‑proveedor con **fallback** y **BYOK**:
   - Proveedores: OpenAI y Anthropic. Selección: `provider=auto|openai|anthropic`. Si llega `X-BYOK-Provider/Key`, úsalo.
   - **Caché** LRU por (tenant, hash(prompt)). TTL configurable.
2) **Redacción y seguridad**:
   - Redactar PII en prompts (email, phone, tarjetas, RFC/NIT) → tokens pseudoaleatorios.
   - **No** enviar payloads reales: usar **esquemas y ejemplos**.
   - Policía de longitud y costo estimado. Presupuesto por tenant/mes.
3) **Endpoints** (Fastify JSON):
   - `POST /ai/generate-workflow` → input natural → **blueprint** → `translateToN8nJSON()` → valida con zod → **dry‑run** en sandbox → devuelve `workflowJSON`, `issues`, `cost_estimate`.
   - `POST /ai/explain-error` → recibe { executionId | logs } → diagnóstico, nodos impactados → **sugerencia** (patch). Incluye `applyPatch: false` para PR.
   - `POST /ai/optimize` → profiler + recomendaciones (batch, cache, retry jitter, concurrencia). Devuelve patch JSON.
   - `POST /ai/apply` → crea **AI‑PR**: guarda diff (Supabase), versiona el workflow en n8n (PATCH) **solo si `role ∈ {editor,admin}`**, y **solo** con flag de plan.
   - `GET /ai/usage` → métricas: prompts, tokens/costo, tasa aceptación, por tenant/usuario.
4) **Blueprint→n8n**:
   - DSL mínimo (`source`, `transform`, `destination`) + conectores comunes (HTTP, HubSpot, Sheets, WhatsApp). Validar campos obligatorios.
5) **Sandbox**:
   - Dry‑run contra **n8n sandbox** (workflow duplicado con mock data), **no** producción. TTL de sandbox. Borrar al finalizar.
6) **UI**:
   - `CommandPalette` (`/`, `cmd+k`): acciones `generar flujo`, `optimizar`, `explicar error`.
   - Botón **Fix con IA** contextual en panel de errores de ejecución (muestra **diff** y botón “Aplicar”).
   - **Playground**: probar prompts, guardar como snippet por tenant.
7) **RBAC & Flags**:
   - Tabla `ai_flags`: `auto_fix_enabled`, `playground_enabled`, `profiler_enabled` por plan.
   - En `apply`, exigir `role` y flags.
8) **Telemetría (anónima)**:
   - `ai_usage`: guarda provider, tokens, costo estimado, latencia, aceptación (`accepted=true/false`). **Sin PII**.
9) **Cost Guardrails**:
   - `ai_budgets`: `monthly_usd`, `spent_usd`, `hard_limit_behavior=block|warn`. En cada request validar.

### Requisitos no funcionales
- TypeScript estricto, zod, pino logs, tests unitarios (Jest/Vitest).
- Env: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_BACKEND_URL`, `N8N_BASE_URL`, `N8N_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Código productivo, claro y documentado. Sin datos reales.

### Entregables mínimos
- `apps/ai-service/src/index.ts` (Fastify + rutas).
- `apps/ai-service/src/modelRouter.ts` (proveedores + fallback + BYOK + caché).
- `apps/ai-service/src/blueprint.ts` (DSL + `translateToN8nJSON`).
- `apps/ai-service/src/redact.ts` (PII → tokens) y `validators.ts` (zod).
- `apps/ai-service/src/sandbox.ts` (dry‑run contra n8n sandbox).
- `apps/portal/components/CommandPalette.tsx` y `FixWithAIButton.tsx`.
- `apps/portal/app/(app)/ai/playground/page.tsx` (guardado de snippets).
- `infra/supabase/migrations/50_ai.sql`.
- `netlify/functions/ai-bridge.ts` (proxy portal→ai-service).
- README con instrucciones y `.env.example`.

## Sprints y tareas (listo para Jira/Linear)

### Sprint AI‑1 (Infra + Seguridad)
- [ ] `ai-service` Fastify + healthcheck + pino + rate‑limit.
- [ ] `modelRouter` con OpenAI+Anthropic, BYOK y caché LRU.
- [ ] Redacción de PII y límites de presupuesto por tenant.
- [ ] SQL `50_ai.sql`: `ai_usage`, `ai_prs`, `ai_budgets`, `ai_prompts`, `ai_flags` + índices + RLS.
- [ ] `ai-bridge` (Netlify) con firma HMAC entre portal y ai-service.

### Sprint AI‑2 (Blueprint + Generación + Sandbox)
- [ ] DSL blueprint + `translateToN8nJSON()` con validación zod.
- [ ] `POST /ai/generate-workflow` con **dry‑run** en sandbox n8n.
- [ ] Mock data generator por conector (HTTP/HubSpot/Sheets/WA).

### Sprint AI‑3 (Explain/Optimize + UI)
- [ ] `POST /ai/explain-error` (root‑cause + patch).
- [ ] `POST /ai/optimize` (profiler + sugerencias).
- [ ] UI `CommandPalette` y `FixWithAIButton` (diff viewer + “Aplicar”).

### Sprint AI‑4 (Apply + Telemetría + Playground)
- [ ] `POST /ai/apply` → crea **AI‑PR** (diff + metadatos) y aplica si RBAC/flag ok.
- [ ] `GET /ai/usage` y dashboard básico en portal.
- [ ] Playground de prompts con snippets por tenant.

## SQL — Supabase `50_ai.sql`

```sql
create table if not exists ai_usage (
  id bigserial primary key,
  created_at timestamptz default now(),
  tenant_id uuid not null,
  user_id uuid,
  provider text not null,           -- openai|anthropic|byok:openai
  tokens_in int default 0,
  tokens_out int default 0,
  cost_usd numeric(10,4) default 0,
  latency_ms int,
  action text not null,             -- generate|explain|optimize|apply
  accepted boolean,
  meta jsonb default '{}'
);
create index on ai_usage (tenant_id, created_at desc);

create table if not exists ai_budgets (
  tenant_id uuid primary key,
  monthly_usd numeric(10,2) not null default 20,
  spent_usd numeric(10,2) not null default 0,
  hard_limit_behavior text not null default 'warn' -- block|warn
);

create table if not exists ai_prs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  tenant_id uuid not null,
  user_id uuid,
  workflow_id text not null,
  diff jsonb not null,              -- patch JSON (antes/después)
  status text not null default 'pending', -- pending|applied|reverted
  notes text
);
create index on ai_prs (tenant_id, created_at desc);

create table if not exists ai_prompts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  tenant_id uuid not null,
  name text not null,
  body text not null,
  meta jsonb default '{}'
);

create table if not exists ai_flags (
  tenant_id uuid primary key,
  auto_fix_enabled boolean default false,
  profiler_enabled boolean default true,
  playground_enabled boolean default true
);

-- Habilitar RLS y políticas mínimas según tu esquema de auth
-- alter table ai_usage enable row level security;
-- ... (políticas según roles)
```

## Variables de entorno (ejemplo)

```
# AI back-end
AI_BACKEND_URL=https://api.rp9.io/ai
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_CACHE_TTL_SEC=600
AI_BUDGET_DEFAULT_USD=20

# n8n (Railway)
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__

# Supabase (service role para ai-service)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Firma HMAC (portal→ai-service)
AI_HMAC_SECRET=change_me
```

## Cómo usar este pack
1) Sube el contenido del ZIP a tu repo (monorepo `rp9/`).
2) Ejecuta migración `50_ai.sql` en Supabase.
3) Despliega `apps/ai-service` en tu VPS/BFF y configura `AI_BACKEND_URL` en el portal.
4) (Opcional) Publica `netlify/functions/ai-bridge.ts` para proxyear desde el hosting del portal.
5) Activa flags `ai_flags` por plan/tenant y define `ai_budgets`.
6) Prueba `CommandPalette` (`/` o `cmd+k`) y usa el botón **Fix con IA** en el panel de errores.

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
