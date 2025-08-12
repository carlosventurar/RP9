# Runbook: Gestión de Incidentes

## 🚨 Clasificación de Severidades

### Sev1 - Crítico
- **Descripción**: Caída total del servicio o fuga de datos
- **Impacto**: >50% usuarios afectados, pérdida de datos, brecha de seguridad
- **Tiempo de respuesta**: 15 minutos
- **Comunicación**: Inmediata en #incidents + Status Page
- **Escalación**: Bridge call automático

### Sev2 - Alto
- **Descripción**: Región o feature crítica degradada
- **Impacto**: Funcionalidad clave no disponible, performance severamente degradado
- **Tiempo de respuesta**: 30 minutos
- **Comunicación**: Slack + Status Page en 1 hora
- **Escalación**: Owner on-call + Lead

### Sev3 - Medio
- **Descripción**: Bug menor con workaround disponible
- **Impacto**: Funcionalidad menor afectada, workaround existe
- **Tiempo de respuesta**: Durante horario laboral
- **Comunicación**: Ticket interno
- **Escalación**: Desarrollo normal

## 📋 Proceso de Respuesta

### 1. Detección y Declaración
```
1. Incidente detectado via:
   - Alertas automatizadas
   - Reportes de usuarios
   - Monitoring activo

2. Declarar severidad:
   /incident sev1|sev2|sev3 "Descripción"

3. Asignar incident commander (IC)
```

### 2. Comunicación Inicial
```
Templates de comunicación:

Sev1/Sev2:
"🚨 INCIDENT SEV{N} - {TITULO}
Status: INVESTIGATING
Impact: {IMPACTO}
ETA: {ESTIMACION}
Updates: Every 30min
IC: @{NOMBRE}"

Status Page:
- Update components affected
- Post initial message
- Set update schedule
```

### 3. Investigación y Mitigación
```
1. Crear incident timeline:
   - Primera detección
   - Acciones tomadas
   - Cambios aplicados

2. Diagnosticar causa raíz:
   - Revisar logs recientes
   - Verificar deployments
   - Verificar métricas

3. Implementar mitigación:
   - Rollback si necesario
   - Scaling manual
   - Failover procedures
```

### 4. Resolución
```
1. Confirmar resolución:
   - Métricas normalizadas
   - Funcionalidad restaurada
   - Validación de usuarios

2. Comunicar resolución:
   - Update Slack #incidents
   - Update Status Page
   - Close incident

3. Programar postmortem (48h max)
```

## 🔧 Herramientas y Comandos

### Comandos de Diagnóstico
```bash
# Verificar health endpoints
curl https://rp9.com/api/healthcheck

# Logs recientes (última hora)
# Revisar en Netlify Functions logs

# Métricas de n8n
curl -H "X-N8N-API-KEY: $KEY" $N8N_BASE_URL/api/v1/workflows?active=true

# Verificar Supabase
# Dashboard en Supabase console
```

### Escalación
```
Sev1: Inmediato
- IC principal
- CTO/Founder
- Bridge call en 15 min

Sev2: En 30 min
- IC + 1 desarrollador
- Lead técnico

Sev3: Horario laboral
- Assigned developer
- Next standup
```

## 📊 Métricas Clave

### SLIs a monitorear durante incidentes:
- **Availability**: Uptime del servicio
- **Error Rate**: % de requests fallidos
- **Latency**: P95 response time
- **Throughput**: Requests per minute

### Thresholds de alerta:
- Error rate > 2% (5min) → Sev2
- P95 latency > 3s (10min) → Sev2
- Availability < 99% (1min) → Sev1

## 📝 Postmortem Template

```markdown
# Postmortem: [Fecha] - [Título del Incidente]

## Resumen
- Duración: X horas Y minutos
- Impacto: X usuarios afectados
- Causa raíz: [Causa principal]

## Timeline
| Tiempo | Acción |
|--------|--------|
| XX:XX | Incidente detectado |
| XX:XX | Mitigación iniciada |
| XX:XX | Servicio restaurado |

## Causa Raíz
[Explicación detallada]

## Acciones Correctivas
| Acción | Owner | Fecha límite |
|--------|-------|--------------|
| [Acción 1] | @usuario | YYYY-MM-DD |
| [Acción 2] | @usuario | YYYY-MM-DD |

## Lecciones Aprendidas
- [Lección 1]
- [Lección 2]
```

## 📞 Contactos de Emergencia

```
Incident Commander: @founder
Technical Lead: @dev-lead
Business Contact: @ceo

Slack: #incidents
Status Page: status.rp9.com
Support: support@rp9.com
```

---
**Última actualización**: Fase 4 - Agosto 2024