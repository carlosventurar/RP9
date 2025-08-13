# RP9 — Fase 13: Escalado & Multi‑tenancy (Orchestrator)

> **Contexto**: Seleccionamos la **recomendación** como respuesta para todas las preguntas de esta fase. Este paquete incluye: decisiones cerradas, prompt maestro para Claude Code, SQL de Supabase, API contracts, code‑stubs del Orchestrator (Node.js + TypeScript), Netlify Functions puente, docker compose de ejemplo, monitoreo y playbooks operativos.

---

## 1) Decisiones cerradas (20/20)

1) **Modelo de tenancy inicial:** **C) Híbrido** — iniciar compartido y promocionar a dedicado al crecer.
2) **Disparadores a dedicado:** **A + B** — umbrales de performance/uso + requisitos de compliance.
3) **Dónde corre el orquestador:** **A)** Node.js + Docker API en VPS (Traefik).
4) **Aislamiento de base de datos:** **A en dedicado, B en compartido**.
5) **Gestión de secretos:** **A)** Vault/Doppler/1Password Connect (KMS).
6) **Ruteo & dominios:** **A con C opcional** — `cliente.rp9.io` y dominio custom opcional.
7) **Reverse proxy:** **A)** Traefik (labels, ACME, métricas).
8) **Modo n8n:** **A)** Queue mode con Redis + workers.
9) **Señal de autoscaling:** **B + C** — cola/tiempo en cola + ejec/min y p95.
10) **Enforcement límites por plan:** **A + C** — en BFF con fuente Stripe.
11) **Qué limitar por plan:** **A + B** — ejecuciones/mes + recursos.
12) **Migración a dedicado:** **A)** Clonar DB + export/import + cutover (5–10 min).
13) **Backups:** **A)** Diario + semanal + S3 compatible.
14) **Restores & drills:** **A)** Trimestral.
15) **Observabilidad:** **A hoy** (Prom+Grafana+Loki), evaluar **C** al crecer.
16) **Dónde guardar métricas de negocio:** **C)** Ops en Prom, negocio en Supabase.
17) **Asignación de costos:** **C)** Híbrido (ejec/duración + recursos).
18) **Upgrades de n8n:** **A)** Blue/Green por tenant (staged).
19) **DR & multi‑región:** **A hoy**, **B** como add‑on Enterprise.
20) **Residencia de datos:** **A por ahora**; **C** on‑demand para Enterprise.

---

## 2) Stack & supuestos de integración

- **Tu stack**: GitHub, Netlify (Functions), Supabase (DB/Storage/Auth), Stripe, n8n (shared en Railway: `https://primary-production-7f25.up.railway.app/`).
- **Orchestrator**: servicio Node.js/TS en **VPS** con acceso a Docker y al socket de Traefik.
- **Tenancy**: *Compartido* (usa n8n de Railway + Projects/RBAC) y *Dedicado* (contenedor n8n por tenant).
- **Portal**: llama al Orchestrator vía **Netlify Function** (puente) con **JWT + HMAC**.

---

## 3) Master Prompt — Claude Code (cópialo tal cual)

Eres **Platform/Infra Engineer**. En el monorepo `rp9/` agrega el **Orchestrator** y la integración end‑to‑end para multi‑tenancy híbrida:

### Objetivo
- Aprovisionar, escalar, migrar a dedicado, respaldar/restaurar y monitorear **tenants** de n8n con Traefik, Stripe y Supabase.
- Continuidad con el stack actual (Netlify + Supabase + Stripe + n8n Railway).

### Entregables
1. **Servicio `orchestrator/` (Node 18 + TS + Fastify):**
   - Endpoints (JWT + HMAC + rate‑limit):
     - `POST /tenants` (crear) → shared|dedicated.
     - `POST /tenants/:id/scale` (cpu/mem/workers) y `POST /tenants/:id/plan-sync` (Stripe → limits).
     - `POST /tenants/:id/promote` (shared → dedicated).
     - `POST /tenants/:id/backup`, `POST /tenants/:id/restore`.
     - `POST /autoscale/run` (por CRON) y `GET /healthz`.
   - **Docker** con `dockerode`: crear contenedores n8n con labels **Traefik**; health‑checks; restart policy.
   - **Blue/Green**: `n8n-<sub>-blue` / `n8n-<sub>-green` con label de router activo; swap atómico.
   - **Backups**: `pg_dump` + export de workflows/credenciales (API n8n) + envío a S3 compatible.
   - **Métricas**: expón `/metrics` Prometheus (por tenant: cpu/mem/workers/queue_wait_p95).
   - **Logs**: pino JSON; correlation‑id; audit‑trail a Supabase.

2. **SQL Supabase** `infra/supabase/migrations/40_orchestrator.sql`:
   - `tenants` (si no existe), `tenant_instances`, `tenant_limits`, `backups`, `autoscale_events`.
   - Vistas para dashboard Ops y costos por tenant.
   - RLS básica por owner y rol admin.

3. **Netlify Functions (puente):**
   - `orch-bridge.ts` (proxy seguro JWT+HMAC hacia Orchestrator).
   - `tenants-limits-enforce.ts` (CRON: compara consumo/Stripe y aplica límites/alertas).
   - `tenants-promote-scan.ts` (CRON: detecta disparadores A+B y pide `promote`).

4. **DevOps**:
   - `deploy/docker-compose.orchestrator.yml` (Traefik + orchestrator + exporters opcionales).
   - `prometheus/prometheus.yml` + `grafana/dashboards/rp9-tenants.json` (básico).
   - `.env.example` con todas las claves necesarias.

5. **Docs & Playbooks**:
   - README con **procedimiento de migración a dedicado (A)**, **upgrade Blue/Green (A)**, **backup/restore (A/C)** y **drills trimestrales (A)**.
   - API Contracts (request/response), ejemplos `curl`.

### Reglas
- Typesafe (TypeScript), validación **zod**, idempotencia con `Idempotency-Key`.
- Seguridad: JWT HS256, HMAC `x-rp9-signature` (sha256(timestamp\nbody)), anti‑replay ±300s.
- No usar datos reales; seeds/mocks OK.
- Logs estructurados + métricas listadas abajo.

### Env (ejemplo)
```
# Orchestrator
PORT=8080
JWT_SECRET=__SETME__
HMAC_SECRET=__SETME__
POSTGRES_URL=__SETME__          # Supabase postgres conn string (service role)
SUPABASE_URL=__SETME__
SUPABASE_SERVICE_ROLE_KEY=__SETME__
STRIPE_SECRET_KEY=__SETME__
S3_ENDPOINT=__SETME__
S3_BUCKET=rp9-backups
S3_ACCESS_KEY=__SETME__
S3_SECRET_KEY=__SETME__
TRAEFIK_DOMAIN=rp9.io
ACME_EMAIL=infra@rp9.io
N8N_IMAGE=n8nio/n8n:latest
DB_PASSWORD=__SETME__
# Shared (Railway) for hybrid
SHARED_N8N_BASE_URL=https://primary-production-7f25.up.railway.app
SHARED_N8N_API_KEY=__SETME__
```

### Métricas Prometheus (mínimo)
- `rp9_tenant_queue_wait_p95_seconds{tenant=...}`
- `rp9_tenant_cpu_percent{tenant=...}`
- `rp9_tenant_mem_bytes{tenant=...}`
- `rp9_tenant_executions_min{tenant=...}`
- `rp9_autoscale_events_total{tenant=...,action=...}`

---

## 4) API Contracts (resumen)

- `POST /tenants`
```json
{ "name":"ACME", "email":"ops@acme.com", "subdomain":"acme", "mode":"shared|dedicated", "plan":"starter|pro|enterprise", "region":"us-east" }
```
**201 →** `{ "tenant_id":"...", "loginUrl":"https://acme.rp9.io" }`

- `POST /tenants/:id/promote`
```json
{ "window":"2025-08-15T22:00:00Z", "ttl_minutes":5 }
```

- `POST /tenants/:id/scale`
```json
{ "cpu": 100, "memory_mb": 2048, "workers": 2 }
```

- `POST /tenants/:id/backup` → `{ "ok": true, "path": "s3://..." }`

- `POST /autoscale/run` → scan por umbrales (cola/p95/ejec/min), registra eventos y escala si procede.

---

## 5) Playbooks (extracto)

**Migración shared → dedicated (A):**
1. Freeze cambios (5–10 min).
2. Clonar DB `n8n_shared` → `n8n_<sub>`; export workflows/credentials; importar.
3. Desplegar n8n `<sub>-blue`; health OK.
4. **Cutover DNS** (`<sub>.rp9.io`) y habilitar webhooks.
5. Validación smoke; levantar freeze.

**Blue/Green:**
- Crear `-green`, replicar datos, cambiar label router → `green`.
- Si falla, rollback a `-blue`.

**Respaldo:**
- Diario `pg_dump` + JSON workflows + credenciales cifradas → **S3**.
- Semanal full; retención 30 días.

**Restore drill (trimestral):**
- Restaurar un tenant a sandbox; correr checks funcionales.

---

## 6) Observabilidad

- Dashboards Grafana por tenant: **CPU/Mem**, **workers activos**, **p95 cola**, **errores** y **ejec/min**.
- Logs JSON (Pino) con `tenant_id`, `route`, `op_id`.
- Alertas: caída de éxito >20% 24h o `queue_wait_p95 > 5s` → Slack.

---

## 7) Seguridad

- HMAC en todos los webhooks internos/externos.
- Secrets en **Vault/Doppler/1Password Connect**; rotación trimestral.
- RLS en Supabase; auditoría en tabla `audit_logs` (opcional).

---

## 8) Notas de implementación
- En compartido, usa `SHARED_N8N_BASE_URL` + API Key por Project/RBAC.
- En dedicado, contenedor con labels Traefik: `Host(\`<sub>.rp9.io\`)` y service port 5678.
- Enqueue autoscaling por cola: si `queue_wait_p95>5s` o `executions_min>umbral`, agrega worker.
- Enforcement de límites usa Stripe (entitlements) + BFF (phase 8).

# RP9 — Fase 13: Escalado & Multi‑tenancy (Orchestrator)


## Decisiones finales (seleccionadas = recomendación)

1. **Modelo de tenancy**: C (híbrido: compartido → promoción a dedicado).  
2. **Disparadores a dedicado**: A + B (umbral de uso/latencia y requisitos de compliance).  
3. **Dónde corre el orquestador**: A (Node + Docker API en VPS).  
4. **Aislamiento de DB**: A en dedicado; B en compartido.  
5. **Gestión de secretos**: A (Vault/Doppler/1Password Connect).  
6. **Ruteo & dominios**: A + C (subdominio, dominio custom opcional).  
7. **Reverse proxy**: A (Traefik).  
8. **Modo n8n**: A (queue + Redis, workers horizontales).  
9. **Autoscaling (señal)**: B + C (cola p95 + ejec/min/p95 latencia).  
10. **Enforcement límites**: A + C (BFF + entitlements en Stripe).  
11. **Qué limitar**: A + B (ejecuciones/concurrencia + CPU/Mem).  
12. **Migración a dedicado**: A (clonar DB + export/import + cutover corto).  
13. **Backups**: A (diario 7d + semanal 30d + S3 compatible).  
14. **Restores & drills**: A (trimestral).  
15. **Observabilidad**: A hoy (Prom + Grafana + Loki).  
16. **Métricas de negocio**: C (ops en Prom; negocio en Supabase).  
17. **Chargeback**: C (híbrido ejec/duración + recursos).  
18. **Upgrades n8n**: A (blue/green por tenant).  
19. **DR & multi-región**: A (single región + backups; B para Enterprise).  
20. **Residencia de datos**: A hoy; C on‑demand para Enterprise.



## Arquitectura (resumen)

- **Traefik**: subdominio por tenant (`cliente.rp9.io`) + TLS automático + métricas Prometheus.  
- **Orchestrator (Fastify/Node + dockerode)**: crea/escala contenedores `n8n` por tenant, define límites de CPU/Mem, mantiene catálogo `tenant_instances`, ejecuta **backups**, y expone API interna (token).  
- **n8n (queue mode)** por tenant/plan: main + workers (horizontales).  
- **Postgres**: `rp9_platform` (tenants, usage, quotas, backups) + `n8n_*` (por tenant).  
- **Redis**: cola Bull para n8n.  
- **Prometheus + Grafana + Loki**: métricas y logs; dashboards por tenant.  
- **Supabase**: métricas de negocio y billing por uso (ejecuciones/duración) → Stripe.



## API del Orchestrator (interna)

`Authorization: Bearer ${ORCH_TOKEN}` + `X-Signature` (opcional HMAC).

- `POST /tenants` → crear tenant (compartido o dedicado).  
- `POST /tenants/:id/promote` → promoción a dedicado (freeze y cutover).  
- `POST /tenants/:id/scale` → cambiar plan/recursos/num. workers.  
- `POST /tenants/:id/backup` → backup on‑demand; registra en `backups`.  
- `POST /enforcement/run` → aplica límites (suspende/avisa/overage).  
- `GET  /metrics/tenant/:id` → KPIs operativos (CPU/Mem, cola p95, ejec/min, errores).



## Plan de implementación (sprints)

**Sprint 1 – Orchestrator Core**
- Fastify + dockerode + endpoints (create/scale/promote/backup).  
- Tablas `tenant_instances`, `quotas`, `backups`, `autoscaling_events`, `enforcement_events`.  
- Compose de Traefik/Postgres/Redis/Orchestrator + .env.example.

**Sprint 2 – Autoscaling & Enforcement**
- Señales de cola p95 + ejec/min + p95 lat. → `scale workers`.  
- Enforcement por plan (ejecuciones/concurrencia/CPU/Mem) + avisos 80/100% (Stripe entitlements).  
- Netlify Functions programadas para **enforcement** y **collector** (metered).

**Sprint 3 – Promoción a Dedicado & Backups**
- Script `promote_to_dedicated.ts` (freeze, export, import, DNS cutover).  
- Backups nightly + semanal; restore drill sandbox trimestral.  
- Dashboard Grafana por tenant (CPU, wait p95, ejec/min, error rate).

**Sprint 4 – Observabilidad & DR**
- Prometheus rules + alertas.  
- Export de métricas a Supabase (negocio).  
- Runbook DR (RTO<4h) y simulacro.



## Variables de entorno (.env.example)

```
ORCH_PORT=8080
ORCH_TOKEN=super_long_token
BASE_DOMAIN=rp9.io
ACME_EMAIL=admin@rp9.io

# Postgres
DATABASE_URL=postgres://rp9:__PASS__@postgres:5432/rp9_platform

# Redis
REDIS_URL=redis://redis:6379/0

# Stripe (entitlements / metered)
STRIPE_SECRET_KEY=sk_test_xxx

# Supabase (para métricas de negocio)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Vault/Doppler (secrets)
VAULT_ADDR=...
VAULT_TOKEN=...
```


### Notas
- El orquestador vive en **VPS/Hostinger** junto a Traefik/Postgres/Redis.  
- Netlify Functions **no** crean contenedores: invocan al Orchestrator (VPS).  
- Para Stripe metered, usa el collector existente de ejecuciones en n8n.
