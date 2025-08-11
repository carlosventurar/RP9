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
