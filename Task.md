Fase 0 — Preparación (0–1 día)
Objetivo: dejar listo el armazón (repos, CI/CD, secretos, esquema DB).

Tareas

Repos

 Crear monorepo rp9 con apps/portal (Next.js), apps/functions (Netlify Functions), packages/ui (design system), infra/ (migraciones SQL).

 Activar GitHub Projects (board Kanban) y etiquetas: infra, backend, frontend, billing, security, observability, tenancy, templates, ai.

Entornos

 Netlify site para apps/portal (prod y preview).

 Supabase proyecto (Postgres + Auth) → habilitar RLS.

 Stripe cuenta (modo test).

Secretos (GitHub → Settings → Secrets)

 NEXT_PUBLIC_API_BASE=/api (Netlify proxy).

 N8N_BASE_URL=https://primary-production-7f25.up.railway.app/

 N8N_API_KEY=... (key owner o por proyecto).

 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

 STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

 JWT_SECRET (para firmar tokens internos del portal/BFF).

DB (Supabase) — Migración inicial

 Tablas: tenants, plans, subscriptions, usage_executions, templates, template_installs, audit_logs.

 Vistas: dashboard_metrics_24h.

 RLS: políticas por tenant_id.

CI/CD

 GitHub Action: deploy portal a Netlify en main + previews por PR.

 GitHub Action: migraciones Supabase (CLI) en main.

 GitHub Action: lint y typecheck (ESLint + TypeScript) en PR.

Fase 1 — MVP usable (1 semana)
Objetivo: Portal RP9 con login, dashboard básico, flujos y proxy seguro hacia n8n.

Tareas

Auth & Tenancy

 Supabase Auth (email/pass + magic link).

 Tabla tenants vinculada a auth.users (owner + miembros).

 Middleware Next.js: inyectar tenant_id en requests a /api/*.

BFF (Netlify Functions)

 POST /api/auth/session (intercambia token Supabase → JWT interno con tenant_id).

 GET /api/n8n/workflows?active=... → proxifica a ${N8N_BASE_URL}/api/v1/... con X-N8N-API-KEY.

 POST /api/n8n/workflows (crear/actualizar por nombre).

 GET /api/n8n/executions?status=... (para dashboard).

 Seguridad: rate-limit por IP + validación de origen (Netlify), sanitizar payload.

Portal (Next.js, Tailwind, shadcn/ui)

 AppShell (sidebar + header + dark mode).

 Dashboard: KPIs (Ejecuciones hoy, % éxito, p95/avg time, costo estimado placeholder).

 Flujos: listar/activar/desactivar; botón “Crear desde plantilla” (stub).

 Settings del tenant: nombre, logo, clave de API RP9 (generada).

Observabilidad básica

 Log estructurado en Supabase audit_logs para cada acción del portal.

Definición de hecho

 Login funciona, ves tus flujos desde tu n8n en Railway, dashboard muestra ejecuciones de últimas 24h.

Fase 2 — Multi-tenancy + Planes + Billing (1–2 semanas)
Objetivo: planes, suscripciones, metered usage y enforcement suave.

Tareas

Stripe

 Crear precios: Starter (1k), Pro (10k), Enterprise (custom).

 POST /api/billing/checkout (crear sesión de checkout + suscripción).

 Webhook POST /api/billing/stripe-webhook (suscripción creada, renovada, cancelada).

Usage Collector

 Cron (Netlify Scheduled Function) cada 5–10min:

 GET /executions por ventana incremental (guardar en usage_executions).

 Calcular duration_ms = stoppedAt - startedAt y status.

 Subir usage a Stripe (subscription_item) por ejecuciones y/o segundos.

 Idempotencia por execution_id.

Enforcement

 Umbrales por plan (tabla plans.limits): ejecuciones/día y mes.

 Alerta in-app y email al 80% y 100%.

 Overage automático (si allow_overage=true) o throttle (si no).

Portal

 Billing page: estado de plan, consumo, cambiar plan, descargar facturas.

Definición de hecho

 Un tenant se suscribe, ejecuta flujos, consumo sube a Stripe y se refleja en el dashboard/billing.

Fase 3 — Templates + Marketplace (1 semana)
Objetivo: librería de plantillas con instalación 1-click y saneado seguro.

Tareas

Templates

 Tabla templates (JSON del workflow, metadata, precio).

 Sanitización: eliminar credenciales y datos de prueba.

 POST /api/templates/install → crea el workflow en n8n del tenant, mapea credenciales a placeholders.

UI

 Grid con filtros, badges (categoría, dificultad), rating, installs.

 Vista previa rápida (nodos/conexiones simplificadas).

Comercial

 Soporte a plantillas de pago (cobro Stripe one-time a tu cuenta).

Definición de hecho

 Puedo instalar una plantilla gratuita y queda corriendo en mi tenant.

Fase 4 — Versionado, Rollback y Auditoría (1 semana)
Objetivo: control de cambios confiable.

Tareas

Versioning

 Tabla workflow_versions (workflow_id, versión, JSON, diff).

 Hook en creación/actualización → guarda versión.

 POST /api/workflows/:id/rollback?version=n (aplica PATCH en n8n).

Auditoría

 audit_logs para cambios (quién, cuándo, desde dónde, qué).

 Export CSV/JSON.

Definición de hecho

 Desde el portal selecciono versión N y restauro → el flujo queda activo con el JSON antiguo.

Fase 5 — Testing Sandbox + Alertas (1–2 semanas)
Objetivo: pruebas seguras y alertas proactivas.

Tareas

Sandbox

 Modo “SBX” por tenant (Project en n8n o etiqueta) para pruebas aisladas.

 Mocks HTTP y assertions (equals/contains/regex/schema/performance).

 Botón “Promote to Prod” (copia JSON y reasigna credenciales).

Alertas

 Configurar destinos (Slack/Email/WhatsApp Business).

 Reglas: ejecución fallida, tasa de error > X%, p95 > umbral, cola retenida.

Definición de hecho

 Ejecuto pruebas con datos mock y veo resultado/latencia; recibo alerta ante fallos críticos.

Fase 6 — Observabilidad & Seguridad (1 semana)
Objetivo: visibilidad y hardening.

Tareas

Métricas

 Consumir /metrics de n8n (si habilitado) o derivar de usage_executions.

 Dashboard de tendencias (por hora/día, top fallos por nodo).

Seguridad

 HMAC en webhooks (firma y verificación en Function).

 Rate-limit por API key + IP (Netlify Function middleware).

 RLS en todas las tablas con tenant_id.

 Rotación de claves n8n cada N días (tarea programada).

Definición de hecho

 Panel de métricas estable y pruebas de intrusiones básicas superadas.

Fase 7 — Diferenciales (2–3 semanas)
Objetivo: lo que te separa del resto.

Tareas

AI Assistant (gen + debug + profiler)

 POST /api/ai/generate-workflow → prompt en español → devuelve JSON n8n + checklist de credenciales.

 POST /api/ai/explain-error → analiza logs y sugiere fix (retries, backoff, batch).

 Sugerencias de performance (caching/batching/parallel).

SSO/2FA (Enterprise)

 2FA (Supabase Auth + TOTP).

 SSO con Google/Azure (para planes enterprise).

Marketplace monetizado

 Comisión por ventas, payouts simples (inicio manual).

Definición de hecho

 Puedo generar un flujo base por prompt y recibir diagnóstico de errores con acciones sugeridas.

Esquema de datos recomendado (Supabase)
tenants(id uuid, name, plan, owner_user_id, created_at, metadata jsonb)

plans(key, name, price_id, limits jsonb)

subscriptions(id, tenant_id, stripe_customer_id, stripe_subscription_id, status, current_period_end)

usage_executions(id, tenant_id, workflow_id, execution_id, status, started_at, stopped_at, duration_ms)

templates(id uuid, name, description, category, price, workflow_json jsonb, installs, rating)

template_installs(id, tenant_id, template_id, workflow_id, installed_at)

workflow_versions(id, tenant_id, workflow_id, version, json jsonb, diff jsonb, created_at)

audit_logs(id, tenant_id, user_id, action, resource, resource_id, ip, user_agent, created_at, details jsonb)

(RLS siempre por tenant_id + auth.uid(); vistas agregadas para dashboard.)

Rutas clave (Netlify Functions)
POST /api/auth/session → emite JWT RP9 con tenant_id.

GET /api/n8n/workflows | POST /api/n8n/workflows | GET /api/n8n/executions

POST /api/templates/install

POST /api/billing/checkout | POST /api/billing/stripe-webhook

POST /api/workflows/:id/rollback

POST /api/ai/generate-workflow | POST /api/ai/explain-error

Todas validan token Supabase, resuelven tenant_id, aplican rate-limit, y registran audit_logs.

Check rápido de UI (look pro y simple)
Design System: shadcn/ui + Tailwind tokens (spacing generoso, rounded-2xl, sombras suaves).

Tipografía: Inter; 14/16px base; títulos 18–24px.

Paleta: primario #2563EB, apoyo violeta; dark mode por defecto según sistema.

Gráficos: Recharts; 2–3 charts máx. por pantalla; tooltips limpios.

Carga percibida: skeletons para KPIs y listas; toast sutil en acciones.

