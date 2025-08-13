# RP9 Fase 13: Orchestrator Multi-tenancy

## 🎯 Resumen Ejecutivo

La Fase 13 introduce un **sistema completo de orquestación multi-tenant** que permite el escalado híbrido desde shared hasta dedicated infrastructure, con auto-scaling inteligente, enforcement de límites por plan, y promoción automática basada en métricas de performance.

### Funcionalidades Principales

- 🏗️ **Orchestrator Core**: Servicio Node.js/TypeScript con Fastify + dockerode + Traefik
- 🔄 **Modelo Híbrido**: Shared (Railway) → Promoción automática a dedicated (Docker)  
- ⚡ **Auto-scaling**: Basado en cola p95, CPU, memoria y ejecuciones/minuto
- 🛡️ **Enforcement**: Límites por plan sincronizados con Stripe entitlements
- 🚀 **Promoción Automática**: Triggers de performance y compliance para dedicado
- 📊 **Métricas Prometheus**: Por tenant con dashboards Grafana integrados
- 💾 **Backups S3**: Sistema automatizado con restore drills trimestrales
- 🔵🟢 **Blue/Green**: Deployments sin downtime para upgrades n8n

## 📋 Tabla de Contenidos

1. [Arquitectura del Sistema](#arquitectura)
2. [Instalación y Configuración](#instalacion)
3. [API del Orchestrator](#api)
4. [Guía de Uso - Tenants](#tenants)
5. [Auto-scaling y Enforcement](#scaling)  
6. [Promoción a Dedicado](#promocion)
7. [Backups y Restore](#backups)
8. [Observabilidad](#observabilidad)
9. [Playbooks Operativos](#playbooks)
10. [Ventajas de Negocio](#ventajas)

## 🏗️ Arquitectura del Sistema {#arquitectura}

### Componentes Principales

```mermaid
graph TB
    A[Netlify Functions] --> B[Orchestrator VPS]
    B --> C[Traefik Reverse Proxy]
    C --> D[n8n Shared - Railway]
    C --> E[n8n Dedicated Containers]
    B --> F[PostgreSQL + Supabase]
    B --> G[Redis Queue]
    B --> H[S3 Compatible Storage]
    
    subgraph "Multi-tenancy Model"
        D --> |promotion triggers| E
        I[Shared Tenant] --> |auto-promote| J[Dedicated Tenant]
    end
    
    subgraph "Observability Stack"
        K[Prometheus] --> L[Grafana]
        M[Loki Logs] --> L
    end
```

### Flujo de Promoción Híbrida

1. **Tenant Shared**: Inicia en Railway n8n compartido
2. **Métricas Collection**: Monitoreo continuo de performance
3. **Triggers Detection**: Auto-scaling + compliance requirements  
4. **Promoción Automática**: Migración a container dedicado Docker
5. **Blue/Green**: Upgrades sin downtime en dedicado

### Stack Tecnológico

- **Orchestrator**: Node.js 18 + TypeScript + Fastify + dockerode
- **Reverse Proxy**: Traefik v3 con ACME Let's Encrypt automático
- **Containers**: Docker con labels Traefik dinámicos
- **Database**: PostgreSQL + Supabase para RLS y business analytics
- **Queue**: Redis Bull para n8n workers horizontales
- **Storage**: S3 compatible para backups cifrados
- **Monitoring**: Prometheus + Grafana + Loki stack completo

## ⚙️ Instalación y Configuración {#instalacion}

### 1. Aplicar Migración de Base de Datos

```bash
# Ejecutar migración del orchestrator
supabase migration up --file 040_orchestrator.sql
```

### 2. Configurar Orchestrator VPS

```bash
# Clonar repositorio en VPS
git clone https://github.com/rp9/rp9-platform
cd rp9-platform/orchestrator

# Instalar dependencias
npm install --production

# Configurar variables de entorno
cp .env.example .env
# Editar .env con valores de producción

# Construir aplicación
npm run build

# Iniciar con Docker Compose
cd ../deploy
docker-compose -f docker-compose.orchestrator.yml up -d
```

### 3. Variables Críticas de Entorno

```bash
# Orchestrator Core
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
HMAC_SECRET=your-super-secure-hmac-secret-min-32-chars  
POSTGRES_URL=postgresql://user:pass@postgres:5432/rp9_platform

# Docker & Traefik
TRAEFIK_DOMAIN=rp9.io
ACME_EMAIL=admin@rp9.io
DOCKER_SOCKET_PATH=/var/run/docker.sock

# n8n Integration  
N8N_IMAGE=n8nio/n8n:latest
SHARED_N8N_BASE_URL=https://primary-production-7f25.up.railway.app
SHARED_N8N_API_KEY=your-n8n-api-key

# S3 Backups
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=rp9-backups
S3_ACCESS_KEY=your-s3-access-key
S3_SECRET_KEY=your-s3-secret-key

# Stripe Entitlements
STRIPE_SECRET_KEY=sk_live_your_stripe_key

# Observability
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
GRAFANA_ADMIN_PASSWORD=your-secure-grafana-password
```

### 4. Configurar Netlify Bridge Functions

Las siguientes functions se despliegan automáticamente:

- `orch-bridge.ts` - Proxy seguro JWT+HMAC hacia orchestrator VPS
- `tenants-limits-enforce.ts` - CRON hourly enforcement de límites  
- `tenants-promote-scan.ts` - CRON cada 4h para detectar candidatos promoción

## 🔌 API del Orchestrator {#api}

### Endpoints Principales

**Autenticación**: `Authorization: Bearer <JWT>` + `x-rp9-signature: <HMAC>`

#### Gestión de Tenants

```bash
# Crear tenant (shared o dedicated)
POST /tenants
{
  "name": "ACME Corp",
  "email": "admin@acme.com", 
  "subdomain": "acme",
  "mode": "shared",
  "plan": "pro",
  "region": "us-east"
}
# → 201 { tenant_id, login_url, status }

# Escalar recursos de tenant dedicado
POST /tenants/:id/scale  
{
  "cpu": 4,
  "memory_mb": 4096, 
  "workers": 3
}

# Crear backup on-demand
POST /tenants/:id/backup
{
  "backup_type": "manual",
  "includes_database": true,
  "includes_workflows": true,
  "includes_credentials": true
}

# Promover a dedicado
POST /tenants/:id/promote
{
  "window": "2025-08-15T22:00:00Z",
  "ttl_minutes": 10,
  "reason": "High performance requirements"
}
```

#### Auto-scaling y Enforcement

```bash  
# Ejecutar auto-scaling (CRON)
POST /autoscale/run
# → { tenants_checked, actions_taken, actions[] }

# Ejecutar enforcement de límites (CRON)
POST /enforcement/run  
# → { tenants_checked, violations_found, actions_taken }
```

#### Métricas y Health

```bash
# Health check detallado
GET /health/detailed
# → { status, dependencies: { database, docker }, system }

# Métricas Prometheus  
GET /metrics
# → Formato Prometheus con métricas por tenant

# Métricas específicas por tenant
GET /metrics/tenant/:id
# → { queue_wait_p95, cpu_percent, memory_bytes, executions_min }
```

## 👥 Guía de Uso - Tenants {#tenants}

### Lifecycle de Tenants

#### 1. Creación en Shared Mode

Todos los tenants inician en **modo compartido** usando la instancia n8n de Railway:

```javascript
// Crear tenant shared por defecto
const tenant = await fetch('/orch-bridge', {
  method: 'POST',
  body: JSON.stringify({
    action: 'POST',
    endpoint: '/tenants',
    payload: {
      name: 'Mi Empresa',
      email: 'admin@miempresa.com',
      subdomain: 'miempresa', 
      mode: 'shared',  // Por defecto
      plan: 'starter'
    }
  })
})
// → tenant accesible en miempresa.rp9.io (Railway shared)
```

#### 2. Monitoreo Automático

El orchestrator monitora continuamente métricas de performance:

- **Queue Wait P95**: Tiempo de espera en cola de ejecución
- **CPU Usage**: Porcentaje de uso vs límites del plan
- **Memory Usage**: Consumo de memoria vs quotas 
- **Executions/Min**: Throughput de workflows ejecutados
- **Concurrent Executions**: Workflows ejecutándose simultáneamente

#### 3. Triggers de Promoción

**Trigger A - Performance**:
- Queue wait p95 > 5 segundos
- CPU usage > 80% promedio
- Executions/month > 50% del plan Pro (5,000)
- Concurrent executions > 5 simultáneas

**Trigger B - Compliance**:  
- Plan Enterprise (requiere dedicado automáticamente)
- Compliance requirements en metadata
- Custom domain requirements
- Data residency requirements

### Estados de Tenant

- **`provisioning`** - Creándose inicial
- **`active`** - Operando normalmente  
- **`suspended`** - Suspendido por límites
- **`migrating`** - En promoción shared→dedicated
- **`failed`** - Error en operación

### Planes y Recursos

| Plan | CPU | Memory | Workers | Storage | Executions/Month |
|------|-----|---------|---------|---------|-----------------|  
| **Starter** | 1 core | 1GB | 1 | 5GB | 1,000 |
| **Pro** | 2 cores | 2GB | 2 | 20GB | 10,000 |
| **Enterprise** | 4 cores | 4GB | 4 | 100GB | 100,000 |

## ⚡ Auto-scaling y Enforcement {#scaling}

### Auto-scaling Inteligente

El sistema ejecuta auto-scaling cada 15 minutos basado en métricas reales:

#### Triggers de Scale-Up

```typescript
// Ejemplos de condiciones que disparan scaling
if (metrics.queue_wait_p95_seconds > 5.0) {
  // + 1 worker (prioridad alta)
}

if (metrics.cpu_percent > 80) {
  // + 1 CPU core  
}

if (metrics.memory_percent > 85) {
  // + 50% memory
}

if (metrics.executions_per_minute > 10) {
  // + 1 worker adicional
}
```

#### Triggers de Scale-Down

```typescript
// Condiciones para reducir recursos (conservador)
if (metrics.cpu_percent < 20 && metrics.memory_percent < 30) {
  // - 1 CPU core (mínimo 1)
}

if (metrics.queue_wait_p95_seconds < 1 && metrics.executions_per_minute < 2) {
  // - 1 worker (mínimo 1)
}
```

### Enforcement de Límites

El sistema verifica límites cada hora y aplica acciones graduales:

#### Niveles de Enforcement

1. **Warning** (80% del límite): Notificación email + Slack
2. **Throttle** (95% del límite): Rate limiting aplicado  
3. **Suspend** (100% del límite): Tenant suspendido temporalmente
4. **Overage Billing** (Pro/Enterprise): Billing adicional por exceso

#### Límites Monitoreados

- **Executions Monthly**: Según plan (1K/10K/100K)
- **Concurrent Executions**: Workflows simultáneos (2/10/50)
- **CPU Usage**: Porcentaje vs allocation del plan
- **Memory Usage**: MB consumidos vs limits
- **Storage Usage**: GB de archivos/logs/backups
- **API Calls**: Requests/hora a n8n API

### Sincronización con Stripe

```javascript
// Sync automático de entitlements cada hora
const stripeCustomer = await stripe.customers.retrieve(tenant.stripe_customer_id)
const subscription = await stripe.subscriptions.retrieve(customer.subscription.id)

// Actualizar quotas basado en entitlements Stripe  
await updateTenantQuotas(tenantId, {
  executions_monthly: subscription.items[0].price.transform_quantity,
  plan: subscription.items[0].price.nickname, // starter/pro/enterprise
  stripe_entitlements: subscription.metadata
})
```

## 🚀 Promoción a Dedicado {#promocion}

### Proceso de Promoción Automática

#### 1. Detección de Candidatos

Scanner ejecuta cada 4 horas buscando tenants shared que cumplan triggers:

```javascript
// Ejemplo de tenant candidato a promoción
const candidate = {
  tenant_id: 'uuid-123',
  name: 'ACME Corp', 
  reasons: [
    'High execution volume: 8,500/month',
    'High queue latency: 6.2s p95',
    'Enterprise plan requires dedicated infrastructure'
  ],
  priority: 'high', // high/medium/low
  score: 85 // 0-100 algorithmic score
}
```

#### 2. Promoción Programada

```javascript
// Auto-promoción para casos de alta prioridad
const promotion = await orchestrator.promote(tenantId, {
  window: '2025-08-15T22:00:00Z', // Ventana de mantenimiento
  ttl_minutes: 10,                // Tiempo máximo de downtime
  reason: 'Auto-promotion based on performance thresholds'
})

// Response
{
  "promotion_id": "promotion_uuid-123_1693872000",
  "estimated_completion": "2025-08-15T22:15:00Z", 
  "plan": {
    "estimated_downtime_minutes": 8,
    "migration_steps": [
      "1. Create dedicated PostgreSQL database",
      "2. Export workflows from shared instance", 
      "3. Create Docker container with dedicated resources",
      "4. Import data to dedicated database",
      "5. Configure Traefik routing",
      "6. Verify health and connectivity",
      "7. Update DNS/routing (atomic switch)",
      "8. Cleanup shared instance data"
    ]
  }
}
```

#### 3. Migración de Datos

**Freeze Period**: 5-10 minutos máximo
1. **Export from Shared**: Workflows, credentials, settings via n8n API
2. **Container Creation**: Docker con recursos dedicados + Traefik labels  
3. **Data Import**: Workflows + credentials al container dedicado
4. **Health Verification**: Checks de conectividad y funcionalidad
5. **Atomic Switch**: Cambio de routing Traefik (0 downtime)
6. **Cleanup**: Datos del tenant en instancia compartida (opcional)

#### 4. Post-Promoción

```javascript
// Tenant ahora en modo dedicado
{
  "mode": "dedicated",
  "status": "active",
  "login_url": "https://acme.rp9.io", // Mismo URL, diferente backend
  "container_id": "docker-abc123",
  "resources": {
    "cpu_cores": 2,
    "memory_mb": 2048, 
    "workers": 2,
    "storage_gb": 20
  },
  "metadata": {
    "promoted_at": "2025-08-15T22:12:00Z",
    "previous_mode": "shared"
  }
}
```

### Rollback Automático

Si la promoción falla, rollback automático restaura tenant a shared:

```javascript
// En caso de fallo durante promoción
await orchestrator.rollback(tenantId, promotionId)

// Tenant restaurado a shared mode
{
  "mode": "shared", 
  "status": "active",
  "n8n_url": "https://primary-production-7f25.up.railway.app",
  "metadata": {
    "rolled_back_at": "2025-08-15T22:08:00Z",
    "rollback_reason": "Container health check failed"
  }
}
```

## 💾 Backups y Restore {#backups}

### Sistema de Backups S3

#### Tipos de Backup

1. **Daily** - 7 días retención, ejecuta 02:00 UTC
2. **Weekly** - 4 semanas retención, domingos 03:00 UTC  
3. **Monthly** - 12 meses retención, día 1 del mes
4. **Manual** - On-demand, retención configurable
5. **Pre-migration** - Antes de promociones shared→dedicated
6. **Pre-upgrade** - Antes de upgrades n8n Blue/Green

#### Contenido de Backups

```javascript
// Estructura completa de backup
{
  "backup_id": "backup_uuid-123_20250815",
  "tenant_id": "tenant-uuid-123",
  "backup_type": "daily",
  "includes": {
    "database": true,        // pg_dump completo
    "workflows": true,       // JSON export vía n8n API
    "credentials": true,     // Encrypted credentials  
    "files": false,          // User uploaded files
    "executions": false      // Execution history (opcional)
  },
  "s3_path": "tenants/uuid-123/backups/20250815-020000",
  "backup_size_bytes": 52428800, // 50MB
  "retention_until": "2025-08-22T02:00:00Z",
  "status": "completed"
}
```

#### Restore Process

```bash
# Restore completo de tenant
POST /tenants/:id/restore
{
  "backup_id": "backup_uuid-123_20250815", 
  "restore_point": "2025-08-15T02:00:00Z",
  "restore_to_sandbox": true,  // Sandbox para testing
  "include_executions": false
}

# Response
{
  "restore_id": "restore_uuid-123_20250820", 
  "sandbox_url": "https://acme-restore-20250820.rp9.io",
  "estimated_completion": "2025-08-20T14:15:00Z"
}
```

### Restore Drills Trimestrales

Script automatizado para testing de backups:

```javascript
// Ejecuta cada trimestre para validar backups
const restoreDrill = async () => {
  // 1. Seleccionar backup aleatorio de cada tenant
  const backups = await selectRandomBackups()
  
  for (const backup of backups) {
    // 2. Restaurar a sandbox
    const sandbox = await restoreToSandbox(backup)
    
    // 3. Ejecutar smoke tests
    const healthCheck = await runSmokeTests(sandbox)
    
    // 4. Validar integridad de datos
    const integrityCheck = await validateDataIntegrity(sandbox)
    
    // 5. Registrar resultado
    await recordDrillResult(backup.tenant_id, {
      success: healthCheck && integrityCheck,
      sandbox_url: sandbox.url,
      issues_found: healthCheck.issues || []
    })
    
    // 6. Cleanup sandbox
    await cleanupSandbox(sandbox.id)
  }
}
```

## 📊 Observabilidad {#observabilidad}

### Métricas Prometheus

#### Métricas por Tenant (Requeridas)

```prometheus
# Queue wait time p95 por tenant
rp9_tenant_queue_wait_p95_seconds{tenant="acme"} 2.3

# CPU usage porcentaje por tenant  
rp9_tenant_cpu_percent{tenant="acme"} 67.5

# Memory usage en bytes por tenant
rp9_tenant_mem_bytes{tenant="acme"} 1073741824

# Executions per minute por tenant
rp9_tenant_executions_min{tenant="acme"} 8.2

# Autoscale events counter
rp9_autoscale_events_total{tenant="acme",action="scale_up"} 15
```

#### Métricas del Orchestrator

```prometheus
# Total tenants por modo y status
rp9_tenants_total{mode="dedicated",status="active",plan="pro"} 12

# Container stats
rp9_container_stats{stat_type="running"} 45
rp9_container_stats{stat_type="failed"} 2

# Backup metrics  
rp9_backups_total{tenant="acme",status="completed",type="daily"} 7

# Enforcement events
rp9_enforcement_events_total{tenant="acme",action="warning",limit_type="executions_monthly"} 3
```

### Dashboards Grafana

#### Dashboard Principal: RP9 Tenants Overview

```json
{
  "dashboard": {
    "title": "RP9 Multi-tenant Orchestrator",
    "panels": [
      {
        "title": "Tenants por Modo",
        "type": "stat",
        "query": "sum by (mode) (rp9_tenants_total)"
      },
      {
        "title": "Queue Wait P95 Top 10",
        "type": "table", 
        "query": "topk(10, rp9_tenant_queue_wait_p95_seconds)"
      },
      {
        "title": "CPU Usage por Tenant",
        "type": "timeseries",
        "query": "rp9_tenant_cpu_percent"
      },
      {
        "title": "Autoscale Events (24h)",
        "type": "bargauge",
        "query": "increase(rp9_autoscale_events_total[24h])"
      }
    ]
  }
}
```

#### Dashboard por Tenant: Individual Performance

- **Resource Usage**: CPU, Memory, Storage trending
- **Performance**: Queue wait times, execution rate, success rate
- **Scaling Events**: Histórico de scale up/down con razones
- **Enforcement**: Violations, warnings, suspensions
- **Backups**: Success rate, sizes, retention compliance

### Alerting Rules

```yaml
# prometheus/rules/rp9-orchestrator.yml
groups:
- name: rp9_orchestrator_alerts
  rules:
  
  # Queue performance crítica
  - alert: TenantQueueWaitHigh
    expr: rp9_tenant_queue_wait_p95_seconds > 10
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Tenant {{ $labels.tenant }} has high queue wait time"
      description: "Queue P95 wait time is {{ $value }}s (threshold: 10s)"
  
  # Auto-scaling failed
  - alert: AutoscalingFailed  
    expr: increase(rp9_autoscale_events_total{success="false"}[1h]) > 0
    labels:
      severity: warning
    annotations:
      summary: "Autoscaling failed for tenant {{ $labels.tenant }}"
      
  # Container failures
  - alert: ContainersFailed
    expr: rp9_container_stats{stat_type="failed"} > 2
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Multiple containers failed: {{ $value }}"
```

### Logs Estructurados

```json
{
  "timestamp": "2025-08-15T14:30:00.000Z",
  "level": "INFO", 
  "msg": "Tenant promotion completed successfully",
  "tenant_id": "uuid-123",
  "promotion_id": "promotion_uuid-123_1693872000",
  "container_id": "docker-abc123",
  "duration_ms": 8500,
  "correlation_id": "req-uuid-456",
  "audit": true
}
```

## 📖 Playbooks Operativos {#playbooks}

### Playbook 1: Promoción Manual Shared → Dedicated

**Uso**: Cuando cliente requiere migración inmediata por performance o compliance

```bash
# 1. Verificar estado actual del tenant
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123

# 2. Validar métricas pre-promoción  
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/metrics/tenant/uuid-123

# 3. Programar promoción en ventana de mantenimiento
curl -X POST -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     https://orchestrator.rp9.io/tenants/uuid-123/promote \
     -d '{
       "window": "2025-08-15T22:00:00Z",
       "ttl_minutes": 15,
       "reason": "Customer upgrade to Enterprise plan"
     }'

# 4. Monitorear progreso (polling cada 30s)
watch -n 30 'curl -s -H "Authorization: Bearer $JWT" \
              https://orchestrator.rp9.io/tenants/uuid-123 | jq .data.status'

# 5. Validar post-promoción
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/health/detailed

# 6. Smoke test del tenant promovido
curl -H "Authorization: Bearer $API_KEY" \
     https://uuid-123.rp9.io/healthz
```

**Rollback si falla**:
```bash
# Rollback automático en caso de fallo
curl -X POST -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123/rollback \
     -d '{"promotion_id": "promotion_uuid-123_1693872000"}'
```

### Playbook 2: Scaling Manual de Tenant Dedicado

**Uso**: Cliente reporta performance degradada o picos de carga esperados

```bash
# 1. Revisar métricas actuales
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/metrics/tenant/uuid-123

# 2. Revisar histórico de autoscaling
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123 | \
     jq '.data.autoscale_events_30d'

# 3. Scale up preventivo
curl -X POST -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     https://orchestrator.rp9.io/tenants/uuid-123/scale \
     -d '{
       "cpu": 4,
       "memory_mb": 4096,
       "workers": 3
     }'

# 4. Verificar recursos aplicados
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123 | \
     jq '.data.tenant | {cpu_cores, memory_mb, workers}'

# 5. Monitorear performance post-scaling (15 min)
for i in {1..15}; do
  curl -s -H "Authorization: Bearer $JWT" \
       https://orchestrator.rp9.io/metrics/tenant/uuid-123 | \
       jq '{cpu_percent, memory_percent, queue_wait_p95_seconds}'
  sleep 60
done
```

### Playbook 3: Backup y Restore Drill

**Uso**: Testing trimestral de backups según compliance

```bash
# 1. Ejecutar backup manual pre-drill
curl -X POST -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     https://orchestrator.rp9.io/tenants/uuid-123/backup \
     -d '{
       "backup_type": "manual",
       "includes_database": true,
       "includes_workflows": true,
       "includes_credentials": true
     }'

# 2. Listar backups disponibles
curl -H "Authorization: Bearer $JWT" \
     "https://orchestrator.rp9.io/tenants/uuid-123/backups?limit=5"

# 3. Restore a sandbox para testing
curl -X POST -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     https://orchestrator.rp9.io/tenants/uuid-123/restore \
     -d '{
       "backup_id": "backup_uuid-123_20250815",
       "restore_to_sandbox": true,
       "include_executions": false
     }'

# 4. Validar sandbox funcionando
sleep 300  # Esperar 5 min
curl -H "Authorization: Bearer $SANDBOX_API_KEY" \
     https://uuid-123-restore-20250820.rp9.io/healthz

# 5. Ejecutar smoke tests en sandbox
curl -H "Authorization: Bearer $SANDBOX_API_KEY" \
     https://uuid-123-restore-20250820.rp9.io/rest/workflows

# 6. Registrar resultado del drill
curl -X POST -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123/restore-drill \
     -d '{
       "drill_date": "2025-08-20",
       "backup_tested": "backup_uuid-123_20250815",
       "result": "success",
       "issues_found": [],
       "rto_minutes": 8,
       "data_integrity": "100%"
     }'

# 7. Cleanup sandbox
curl -X DELETE -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/sandboxes/uuid-123-restore-20250820
```

### Playbook 4: Blue/Green Deployment n8n

**Uso**: Upgrade de n8n sin downtime para tenants dedicados

```bash
# 1. Verificar versión actual
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123 | \
     jq '.data.tenant.n8n_version'

# 2. Crear container Blue (nueva versión)
curl -X POST -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     https://orchestrator.rp9.io/tenants/uuid-123/blue-green \
     -d '{
       "action": "create_blue",
       "n8n_version": "1.12.0",
       "pre_backup": true
     }'

# 3. Validar Blue container healthy
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123/blue-green/status

# 4. Ejecutar swap atómico (0 downtime)
curl -X POST -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123/blue-green \
     -d '{
       "action": "swap",
       "from": "green", 
       "to": "blue"
     }'

# 5. Validar swap exitoso
curl -H "Authorization: Bearer $TENANT_API_KEY" \
     https://uuid-123.rp9.io/healthz

# 6. Monitorear performance 15 min post-upgrade
for i in {1..15}; do
  curl -s -H "Authorization: Bearer $JWT" \
       https://orchestrator.rp9.io/metrics/tenant/uuid-123 | \
       jq '.success_rate_percent'
  sleep 60
done

# 7. Cleanup container Green (versión anterior)
curl -X POST -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123/blue-green \
     -d '{"action": "cleanup_green"}'
```

**Rollback si falla**:
```bash
# Rollback inmediato a Green
curl -X POST -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123/blue-green \
     -d '{
       "action": "rollback",
       "from": "blue",
       "to": "green"
     }'
```

### Playbook 5: Incident Response - Tenant Down

**Uso**: Tenant reporta servicio no disponible

```bash
# 1. Health check rápido
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/health/detailed

# 2. Status específico del tenant afectado  
curl -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123

# 3. Check container si es dedicado
CONTAINER_ID=$(curl -s -H "Authorization: Bearer $JWT" \
               https://orchestrator.rp9.io/tenants/uuid-123 | \
               jq -r '.data.tenant.container_id')

if [ "$CONTAINER_ID" != "null" ]; then
  docker inspect $CONTAINER_ID
  docker logs --tail 50 $CONTAINER_ID
fi

# 4. Revisar eventos recientes
curl -H "Authorization: Bearer $JWT" \
     "https://orchestrator.rp9.io/tenants/uuid-123/events?hours=2"

# 5. Intentar restart si container está unhealthy
if [ "$CONTAINER_ID" != "null" ]; then
  curl -X POST -H "Authorization: Bearer $JWT" \
       https://orchestrator.rp9.io/tenants/uuid-123/restart
fi

# 6. Escalar a shared como fallback temporal
curl -X POST -H "Authorization: Bearer $JWT" \
     https://orchestrator.rp9.io/tenants/uuid-123/failover \
     -d '{"target": "shared", "reason": "emergency_failover"}'

# 7. Notificar cliente y stakeholders
curl -X POST -H "Content-Type: application/json" \
     "$SLACK_WEBHOOK_URL" \
     -d '{
       "text": "🚨 Tenant Incident - uuid-123",
       "attachments": [{
         "color": "danger",
         "fields": [{
           "title": "Status", 
           "value": "Investigating outage",
           "short": true
         }]
       }]
     }'
```

### Playbook 6: Capacity Planning 

**Uso**: Análisis mensual de crecimiento y planning de recursos

```bash
# 1. Métricas de crecimiento por plan
curl -H "Authorization: Bearer $JWT" \
     "https://orchestrator.rp9.io/analytics/growth?period=30d" | \
     jq '.tenants_by_plan'

# 2. Utilización de recursos por tenant
curl -H "Authorization: Bearer $JWT" \
     "https://orchestrator.rp9.io/analytics/utilization" | \
     jq '.avg_utilization_by_plan'

# 3. Proyección de promociones próximas
curl -H "Authorization: Bearer $JWT" \
     "https://orchestrator.rp9.io/analytics/promotion-forecast" | \
     jq '.candidates_next_30d'

# 4. Costos de infraestructura actuales
curl -H "Authorization: Bearer $JWT" \
     "https://orchestrator.rp9.io/analytics/costs" | \
     jq '.total_monthly_cost_usd'

# 5. Recomendaciones de scaling de VPS
curl -H "Authorization: Bearer $JWT" \
     "https://orchestrator.rp9.io/analytics/recommendations"
```

## 💼 Ventajas de Negocio {#ventajas}

### Para RP9 Platform

#### Escalabilidad Sin Límites
- **Modelo Híbrido**: Optimize costs starting shared, scale to dedicated on-demand
- **Auto-scaling**: Handle traffic spikes without manual intervention
- **Multi-tenant Efficiency**: Single orchestrator manages unlimited tenants
- **Resource Optimization**: Pay only for dedicated resources when needed

#### Competitive Advantages
- **Zero-Downtime Promotions**: Seamless shared→dedicated migrations (5-10 min)
- **Intelligent Auto-promotion**: Performance-based triggers vs manual processes
- **Blue/Green Deployments**: n8n upgrades without service interruption
- **Enterprise Compliance**: Dedicated mode for SOC2/HIPAA/GDPR requirements

#### Operational Excellence
- **Observability-First**: Comprehensive metrics, dashboards, alerting
- **Automated Enforcement**: Stripe-synced limits with graduated responses
- **Disaster Recovery**: S3 backups with quarterly restore drills
- **Audit Trail**: Complete tenant lifecycle tracking for compliance

### Para End Users

#### Performance & Reliability
- **Predictable Performance**: Dedicated resources eliminate noisy neighbor issues
- **SLA Compliance**: 99.9% uptime with automated failover capabilities
- **Scalability Assurance**: Resources auto-adjust to workload demands
- **Zero-Downtime Upgrades**: Always latest n8n version without interruptions

#### Cost Efficiency
- **Start Small**: Begin with shared infrastructure at starter pricing
- **Pay As You Grow**: Automatic promotion only when performance requires it
- **Transparent Pricing**: Clear triggers and resource allocation by plan
- **No Overprovisioning**: Right-sized resources based on actual usage

#### Developer Experience  
- **Same API**: Consistent n8n experience across shared and dedicated modes
- **Custom Domains**: Own branding with dedicated infrastructure
- **Isolated Data**: Complete tenant isolation for sensitive workloads
- **Advanced Features**: Blue/green deployments, custom scaling policies

### ROI Impact

#### Year 1 Projections (Conservative)
- **Cost Savings**: 40% infrastructure costs vs full-dedicated model
- **Customer Retention**: +25% due to performance improvements
- **Support Reduction**: 60% fewer performance-related tickets
- **Revenue Growth**: $50K ARR from Enterprise dedications

#### Year 2 Projections (Aggressive)
- **Scale Efficiency**: Support 10x tenants with same operational overhead
- **Premium Pricing**: 30% price premium for dedicated features
- **Market Expansion**: SOC2 compliance enables Enterprise deals
- **Operational Savings**: $200K/year saved vs manual tenant management

### Technical Debt Reduction

- **Unified Platform**: Single orchestrator vs multiple manual processes
- **Standardized Deployments**: Docker + Traefik vs custom configurations  
- **Automated Operations**: CRON jobs vs manual interventions
- **Consistent Monitoring**: Unified observability vs per-tenant setups

---

## 🎉 **Fase 13 Orchestrator Multi-tenancy Completada Exitosamente!**

*El sistema orchestrator está listo para escalar automáticamente tenants desde shared hasta dedicated infrastructure con performance optimization, compliance enforcement, y zero-downtime operations.*

### Entregables Completados:

✅ **Orchestrator Core** - Servicio completo Node.js/TypeScript + Fastify + dockerode  
✅ **Multi-tenancy Híbrida** - Shared (Railway) → Dedicated (Docker) con promoción automática  
✅ **Auto-scaling** - Métricas cola p95, CPU, memoria, executions/min con triggers inteligentes  
✅ **Enforcement** - Límites por plan sincronizados con Stripe entitlements  
✅ **Netlify Bridge** - Proxy seguro JWT+HMAC entre Functions y VPS orchestrator  
✅ **Promoción Automática** - Scanner cada 4h + migración programada con rollback  
✅ **Backups S3** - Sistema completo con restore drills trimestrales  
✅ **Observabilidad** - Prometheus + Grafana + alerting Slack completo  
✅ **Playbooks** - 6 playbooks operativos para incident response y maintenance  
✅ **Docker Compose** - Stack completo Traefik + PostgreSQL + Redis + Orchestrator  

### Próximos Pasos Recomendados:

1. **Deploy a Producción**: VPS setup con docker-compose.orchestrator.yml  
2. **Testing Integral**: Smoke tests de promoción y auto-scaling  
3. **Monitoreo**: Configurar alerting Slack y dashboards Grafana  
4. **Documentation**: Training para equipo de ops y customer success  
5. **Gradual Rollout**: Habilitar auto-promoción para subset de tenants  

El orchestrator está diseñado para growth sostenible, operational excellence, y customer satisfaction a través de performance predictable y zero-downtime operations.