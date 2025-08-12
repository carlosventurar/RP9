# Runbook: Backup y Disaster Recovery

## 📋 Estrategia de Backup

### Componentes respaldados:
- **n8n Workflows**: Export completo de workflows y configuraciones
- **Supabase Database**: Tablas críticas (tenants, usage_executions, audit_log, templates)
- **Configuraciones**: Environment variables y settings
- **Artefactos**: Builds y deployment configs

### Frecuencia y Retención:
- **Backup Diario**: 2:00 AM UTC automático
- **Retención**: 14 días (configurable via BACKUP_RETENTION_DAYS)
- **Cifrado**: AES-256 con BACKUPS_ENCRYPTION_KEY
- **Storage**: Supabase Storage bucket "backups"

## 🔄 Proceso de Backup Automatizado

### Configuración
```bash
# Variables requeridas en Netlify
BACKUPS_BUCKET=supabase://backups
BACKUPS_ENCRYPTION_KEY=your-32-char-encryption-key
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=your-n8n-api-key
```

### Ejecución Manual
```bash
# Ejecutar backup manualmente
curl -X POST https://rp9.netlify.app/.netlify/functions/backup-run \
  -H "Content-Type: application/json" \
  -H "x-backup-critical: true"
```

### Monitoreo de Backups
- **Success**: Log en audit_log + notification opcional
- **Failure**: Alerta Sev2 automática en Slack
- **Size monitoring**: Alertar si backup > 500MB o < 1MB (anomalía)

## 🔧 Proceso de Restore

### Restore Test Mensual (Primer lunes de cada mes)

#### 1. Preparación
```bash
# Verificar último backup disponible
curl https://rp9.netlify.app/.netlify/functions/backup-run?action=list

# Crear entorno sandbox (manual por ahora)
# - Crear schema temporal en Supabase
# - Configurar variables de sandbox
```

#### 2. Ejecución de Restore
```bash
# Ejecutar restore test
curl -X POST https://rp9.netlify.app/.netlify/functions/restore-sandbox \
  -H "Content-Type: application/json" \
  -d '{"test_mode": true, "target_schema": "sandbox"}'
```

#### 3. Validación de Integridad
```sql
-- Verificaciones en sandbox
SELECT 
  'tenants' as table_name,
  count(*) as record_count,
  min(created_at) as oldest_record,
  max(created_at) as newest_record
FROM sandbox.tenants
UNION ALL
SELECT 
  'workflows_backup',
  count(*),
  min(exported_at),
  max(exported_at)
FROM sandbox.backup_validation;

-- Verificar checksums si están disponibles
```

#### 4. Documentación de Resultados
```markdown
## Restore Test Report - [FECHA]

### Backup Info:
- Backup file: rp9-backup-2024-08-12-1723467234.enc
- Backup date: 2024-08-12T02:00:00Z
- Size: 2.4 MB encrypted

### Validation Results:
✅ Backup decryption successful
✅ JSON structure valid
✅ Workflows count: 47 (expected ~45-50)
✅ Data integrity checks passed
⚠️  Backup age: 2 days (acceptable)

### Performance:
- Restore time: 3.2 minutes
- Validation time: 45 seconds
- Total RTO: 4 minutes

### Issues Found:
None

### Next Actions:
- Update backup retention policy
- Test restore on dedicated DB instance
```

## 🚨 Disaster Recovery Procedures

### Escenarios de Disaster Recovery

#### Escenario 1: Pérdida Total de n8n
**RTO**: 2 horas | **RPO**: 24 horas

```bash
# 1. Provision new n8n instance
# 2. Restore workflows from backup
curl -X POST $RECOVERY_ENDPOINT/restore-n8n \
  -d '{"backup_file": "latest", "target_instance": "new_n8n_url"}'

# 3. Validate workflows
# 4. Update DNS/routing
```

#### Escenario 2: Pérdida de Base de Datos
**RTO**: 4 horas | **RPO**: 24 horas

```sql
-- 1. Restore from Supabase backup (automated)
-- 2. Restore custom tables from our backup
CALL restore_tables_from_backup('rp9-backup-latest.enc');

-- 3. Validate data consistency
SELECT verify_data_integrity();
```

#### Escenario 3: Pérdida Total del Portal
**RTO**: 1 hora | **RPO**: Last deployment

```bash
# 1. Redeploy from Git (automated via Netlify)
# 2. Restore environment variables
# 3. Validate all endpoints
# 4. Update external integrations
```

### Emergency Contacts
```
Primary: @founder (24/7)
Technical: @dev-lead (business hours)
Backup: @senior-dev (escalation)

Vendors:
- Supabase Support: support@supabase.io
- Railway Support: help@railway.app
- Netlify Support: support@netlify.com
```

## 📊 Backup Health Metrics

### Daily Monitoring
- Backup completion status
- Backup size trends
- Encryption validation
- Storage quota usage

### Weekly Review
- Restore test results
- Performance trends
- Failure analysis
- Capacity planning

### Monthly Reporting
```markdown
## Backup & DR Report - [MES/AÑO]

### Backup Performance:
- Success rate: 99.7% (1 failed backup)
- Average size: 2.1 MB
- Average time: 23 seconds
- Storage used: 34 MB (14 day retention)

### Restore Tests:
- Tests performed: 1
- Success rate: 100%
- Average RTO: 4 minutes
- Issues found: 0

### Improvements:
- [Action items from the month]
```

---
**Última actualización**: Fase 4 - Agosto 2024