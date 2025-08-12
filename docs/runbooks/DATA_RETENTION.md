# Runbook: Data Retention y Compliance

## 📋 Política de Retención de Datos

### Clasificación de Datos

#### 1. Datos Críticos de Negocio
- **Tenant information**: Permanente (mientras activo)
- **Billing records**: 7 años (requerimiento legal)
- **Audit logs**: 90 días (configurable)
- **Templates**: Permanente

#### 2. Datos Operacionales
- **Usage executions**: 60 días por defecto
- **System logs**: 30 días
- **Error logs**: 90 días
- **Performance metrics**: 30 días

#### 3. Datos Temporales
- **Session data**: 24 horas
- **Cache data**: 1 hora - 24 horas
- **Backups**: 14 días

### Configuración por Tenant
```sql
-- Ver políticas de retención por tenant
SELECT 
  t.name,
  dr.payload_retention_days,
  dr.anonymize_after_days,
  dr.created_at
FROM tenants t
JOIN data_retention dr ON t.id = dr.tenant_id;

-- Configurar retención personalizada para tenant
INSERT INTO data_retention (tenant_id, payload_retention_days, anonymize_after_days)
VALUES ('tenant-uuid', 90, 365);
```

## 🔄 Proceso de Data Cleanup

### Job Automático de Limpieza (Diario - 3:00 AM UTC)

#### 1. Usage Executions Cleanup
```sql
-- Eliminar executions antigas según política
DELETE FROM usage_executions 
WHERE started_at < NOW() - INTERVAL '60 days'
  AND tenant_id NOT IN (
    SELECT tenant_id FROM data_retention 
    WHERE payload_retention_days > 60
  );

-- Cleanup personalizado por tenant
DELETE FROM usage_executions ue
USING data_retention dr
WHERE ue.tenant_id = dr.tenant_id
  AND ue.started_at < NOW() - (dr.payload_retention_days || ' days')::INTERVAL;
```

#### 2. Audit Logs Cleanup
```sql
-- Limpiar audit logs antiguos (mantener hash chain)
WITH old_logs AS (
  SELECT id FROM audit_log 
  WHERE at < NOW() - INTERVAL '90 days'
  ORDER BY at ASC
)
DELETE FROM audit_log 
WHERE id IN (SELECT id FROM old_logs);
```

#### 3. Anonymization Process
```sql
-- Anonimizar datos sensibles después de período especificado
UPDATE usage_executions 
SET meta = jsonb_set(
  meta, 
  '{anonymized}', 
  'true'::jsonb
) - 'sensitive_data'
WHERE started_at < NOW() - (
  SELECT anonymize_after_days || ' days'
  FROM data_retention dr 
  WHERE dr.tenant_id = usage_executions.tenant_id
)::INTERVAL
AND meta->>'anonymized' IS NULL;
```

### Manual Cleanup Procedures

#### Emergency Data Purge (GDPR/Compliance)
```bash
# Función para eliminar completamente datos de un tenant
curl -X POST https://rp9.netlify.app/.netlify/functions/data-purge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "tenant_id": "uuid",
    "purge_type": "complete",
    "reason": "GDPR request",
    "requested_by": "admin@rp9.com"
  }'
```

#### Selective Data Export (Before Deletion)
```sql
-- Export completo de datos antes de purge
COPY (
  SELECT * FROM usage_executions 
  WHERE tenant_id = 'uuid'
) TO '/tmp/tenant_data_export.csv' WITH CSV HEADER;

-- Audit trail del export
INSERT INTO audit_log (action, resource, meta, tenant_id, hash)
VALUES (
  'data.exported',
  'tenant/uuid',
  '{"export_reason": "pre_deletion", "record_count": 1234}',
  'uuid',
  'hash_placeholder'
);
```

## 📊 Data Retention Monitoring

### Métricas Clave
```sql
-- Dashboard de retención de datos
WITH retention_stats AS (
  SELECT 
    'usage_executions' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE started_at < NOW() - INTERVAL '30 days') as records_30d,
    COUNT(*) FILTER (WHERE started_at < NOW() - INTERVAL '60 days') as records_60d,
    COUNT(*) FILTER (WHERE started_at < NOW() - INTERVAL '90 days') as records_90d
  FROM usage_executions
  
  UNION ALL
  
  SELECT 
    'audit_log',
    COUNT(*),
    COUNT(*) FILTER (WHERE at < NOW() - INTERVAL '30 days'),
    COUNT(*) FILTER (WHERE at < NOW() - INTERVAL '60 days'),
    COUNT(*) FILTER (WHERE at < NOW() - INTERVAL '90 days')
  FROM audit_log
)
SELECT * FROM retention_stats;
```

### Alertas de Crecimiento de Datos
```typescript
// En monitoring function
const dataGrowthAlert = {
  metric: 'database_size',
  threshold: '1GB',
  action: 'alert_admin',
  message: 'Database size exceeding expected growth pattern'
};

// Verificación de storage usage
const storageCheck = `
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
`;
```

## 🔒 Compliance y Auditoría

### GDPR Compliance
```markdown
### Right to be Forgotten Implementation:
1. **Data Identification**: Map all tenant data locations
2. **Purge Process**: Complete removal from all systems
3. **Verification**: Confirm deletion across backups
4. **Documentation**: Audit trail of deletion process

### Data Processing Records:
- Purpose: Business automation platform
- Legal basis: Contract performance
- Retention: As specified in data retention policy
- Data subjects: Business users and their workflow data
```

### Audit Trail para Retention
```sql
-- Tracking de data retention events
CREATE TABLE IF NOT EXISTS retention_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  table_name TEXT,
  action TEXT, -- 'deleted', 'anonymized', 'exported'
  records_affected INTEGER,
  retention_policy_days INTEGER,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by TEXT
);

-- Log retention actions
INSERT INTO retention_audit (
  tenant_id, table_name, action, records_affected, executed_by
) VALUES (
  'tenant-uuid', 'usage_executions', 'deleted', 1500, 'system_cleanup'
);
```

## 📅 Compliance Calendar

### Weekly Tasks
- [ ] Monitor database growth trends
- [ ] Verify cleanup job execution
- [ ] Review retention policy exceptions

### Monthly Tasks
- [ ] Generate data retention report
- [ ] Review tenant-specific policies
- [ ] Audit anonymization effectiveness
- [ ] Update compliance documentation

### Quarterly Tasks
- [ ] Full data audit across all systems
- [ ] Review and update retention policies
- [ ] Validate backup cleanup processes
- [ ] Legal compliance review

## 📋 Checklist de Implementación

### Setup Inicial
- [ ] Configurar tabla `data_retention`
- [ ] Implementar job de cleanup automático
- [ ] Configurar alertas de crecimiento
- [ ] Documentar políticas por tipo de dato

### Testing
- [ ] Verificar cleanup en ambiente de desarrollo
- [ ] Validar anonymization process
- [ ] Probar emergency purge procedures
- [ ] Confirmar audit trail functionality

### Production Deployment
- [ ] Aplicar políticas default
- [ ] Configurar monitoring y alertas
- [ ] Programar backups before cleanup
- [ ] Notificar a tenants sobre políticas

---
**Última actualización**: Fase 4 - Agosto 2024