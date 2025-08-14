# 🚀 Deploy Fase 16 - Migración Supabase Legal System

## ⚠️ IMPORTANTE: Ejecutar en Supabase Producción

### Paso 1: Acceder a Supabase Dashboard
1. Ir a: https://app.supabase.com/projects
2. Seleccionar el proyecto de **PRODUCCIÓN** de RP9 Portal
3. Navegar a **SQL Editor** en el sidebar izquierdo

### Paso 2: Ejecutar Migración Legal System
1. Crear nueva query en SQL Editor
2. Copiar **todo el contenido** del archivo `supabase/migrations/093_legal_system.sql`
3. Pegar en el editor SQL
4. **EJECUTAR** la migración completa

### Paso 3: Verificación de Migración Exitosa

#### Verificar Tablas Creadas (10 tablas)
```sql
-- Ejecutar para verificar tablas:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%legal%' 
OR table_name IN ('contracts', 'subprocessors', 'incidents', 'maintenances', 'sla_metrics', 'sla_credits', 'retention_policies');
```

**Resultado esperado:**
- legal_documents
- legal_acceptances  
- contracts
- subprocessors
- subprocessor_subscriptions
- incidents
- maintenances
- sla_metrics
- sla_credits
- retention_policies

#### Verificar Funciones SQL
```sql
-- Verificar funciones creadas:
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('calculate_sla_credit', 'get_latest_legal_document', 'user_has_accepted_latest_tos');
```

#### Verificar RLS Habilitado
```sql
-- Verificar Row Level Security:
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE '%legal%' 
OR tablename IN ('contracts', 'subprocessors', 'incidents', 'sla_metrics');
```

**Resultado esperado:** Todas las tablas deben tener `rowsecurity = true`

#### Verificar Datos Semilla
```sql
-- Verificar subprocesadores insertados:
SELECT name, purpose, location FROM subprocessors WHERE status = 'active';

-- Verificar documentos legales base:
SELECT document_type, language, version, status FROM legal_documents;
```

### Paso 4: Test Básico de Inserción
```sql
-- Test inserción en legal_acceptances (simulado):
INSERT INTO legal_acceptances (
  user_id, 
  tenant_id, 
  document_type, 
  document_version, 
  language, 
  ip_address,
  user_agent
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM tenants LIMIT 1),
  'tos',
  '2025-01',
  'es',
  '127.0.0.1',
  'Test Browser'
);

-- Verificar inserción:
SELECT * FROM legal_acceptances ORDER BY accepted_at DESC LIMIT 1;
```

## ✅ Checklist de Verificación

- [ ] 10 tablas legales creadas correctamente
- [ ] 3 funciones SQL funcionando
- [ ] RLS habilitado en todas las tablas
- [ ] 5 subprocesadores insertados como seed data
- [ ] 4 documentos legales base creados
- [ ] Test de inserción exitoso
- [ ] Vista materializada `sla_monthly_summary` creada
- [ ] Triggers de audit trail funcionando

## 🚨 En Caso de Errores

### Error: "relation already exists"
- **Causa:** Tabla ya existe de migración anterior
- **Solución:** Usar `CREATE TABLE IF NOT EXISTS` o DROP TABLE primero

### Error: "permission denied"
- **Causa:** Usuario sin permisos suficientes
- **Solución:** Usar service role key en lugar de anon key

### Error: "function does not exist"
- **Causa:** Extensión uuid-ossp no habilitada
- **Solución:** Ejecutar `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` primero

### Error: "foreign key constraint"
- **Causa:** Falta tabla referenciada (auth.users, tenants)
- **Solución:** Verificar que las tablas base existen primero

## 📞 Soporte
Si hay problemas con la migración:
1. Revisar logs de error en Supabase
2. Verificar que el proyecto es el correcto (PRODUCCIÓN)
3. Contactar al equipo de desarrollo

---

**⚠️ IMPORTANTE:** Esta migración es IRREVERSIBLE. Asegúrate de estar en el proyecto correcto antes de ejecutar.

**✅ ÉXITO:** Si todos los checks pasan, la infraestructura legal está lista para recibir tráfico de producción.