# Runbook: Access Review y Gestión de Permisos

## 📋 Revisión Mensual de Accesos

### Objetivo
Verificar que todos los accesos y permisos estén alineados con el principio de menor privilegio y las necesidades actuales del negocio.

## 🔍 Checklist de Revisión Mensual

### 1. Revisión de Usuarios Supabase Auth
```sql
-- Usuarios activos en los últimos 30 días
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users 
WHERE last_sign_in_at >= NOW() - INTERVAL '30 days'
ORDER BY last_sign_in_at DESC;

-- Usuarios inactivos (más de 90 días)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users 
WHERE last_sign_in_at < NOW() - INTERVAL '90 days'
   OR last_sign_in_at IS NULL;
```

### 2. Revisión de Tenants y Ownership
```sql
-- Tenants activos y sus owners
SELECT 
  t.id,
  t.name,
  t.owner_user,
  u.email as owner_email,
  t.plan,
  t.created_at
FROM tenants t
JOIN auth.users u ON t.owner_user = u.id
ORDER BY t.created_at DESC;

-- Tenants sin actividad reciente
SELECT 
  t.id,
  t.name,
  COUNT(ue.id) as executions_last_30_days
FROM tenants t
LEFT JOIN usage_executions ue ON t.id = ue.tenant_id 
  AND ue.started_at >= NOW() - INTERVAL '30 days'
GROUP BY t.id, t.name
HAVING COUNT(ue.id) = 0;
```

### 3. Revisión de API Keys y Secrets

#### n8n API Keys
```bash
# Verificar vigencia y última actividad
# (Revisar logs de n8n para uso reciente de API keys)

# Rotar API keys si >90 días
# 1. Generar nueva API key en n8n
# 2. Actualizar variables de entorno
# 3. Validar funcionalidad
# 4. Revocar API key anterior
```

#### Verificación de Secrets
```bash
# Revisar edad de secrets críticos
echo "Secrets a revisar:"
echo "- JWT_SECRET (rotar cada 90 días)"
echo "- HMAC_SECRET (rotar cada 90 días)"
echo "- BACKUPS_ENCRYPTION_KEY (rotar cada 180 días)"
echo "- Stripe webhook secrets (validar activos)"
```

### 4. Revisión de Permisos Cloud

#### Netlify
- [ ] Revisar miembros del team
- [ ] Verificar deploy keys
- [ ] Validar environment variables
- [ ] Revisar webhooks activos

#### Supabase
- [ ] Revisar usuarios del proyecto
- [ ] Validar API keys activas
- [ ] Verificar RLS policies
- [ ] Revisar backups automáticos

#### Railway (n8n)
- [ ] Revisar acceso al proyecto
- [ ] Validar variables de entorno
- [ ] Verificar recursos y limits
- [ ] Revisar logs de acceso

## 👥 Gestión de Usuarios

### Tipos de Acceso por Rol

#### Founder/Owner
- **Acceso**: Completo a todos los sistemas
- **Responsabilidades**: 
  - Gestión de billing
  - Configuración de seguridad
  - Access reviews
  - Emergency response

#### Developer/Admin
- **Acceso**: 
  - Supabase dashboard (read-write)
  - Netlify deployment
  - n8n admin (si necesario)
- **Restricciones**:
  - No acceso a billing
  - No rotación de secrets críticos

#### Support/Viewer
- **Acceso**:
  - Portal RP9 (read-only)
  - Logs y métricas básicas
- **Restricciones**:
  - No acceso a datos de usuarios
  - No configuración de sistema

### Procedimiento de Onboarding
```markdown
1. Crear cuenta en sistemas necesarios
2. Asignar rol mínimo requerido
3. Configurar 2FA en todos los servicios
4. Documentar acceso en access matrix
5. Programar review en 30 días
```

### Procedimiento de Offboarding
```markdown
1. Revocar acceso a todos los sistemas
2. Rotar secrets compartidos si necesario
3. Transferir ownership de recursos
4. Documentar cambios
5. Notificar a equipo de seguridad
```

## 🔐 Security Hardening

### Configuraciones de Seguridad por Servicio

#### Supabase
- [ ] RLS habilitado en todas las tablas
- [ ] 2FA obligatorio para admin users
- [ ] IP allowlist configurada (si aplicable)
- [ ] Backup automático habilitado
- [ ] Audit logs activados

#### Netlify
- [ ] Deploy notifications configuradas
- [ ] Branch protection en main
- [ ] Environment variables seguras
- [ ] HTTPS enforcement
- [ ] Security headers configurados

#### n8n (Railway)
- [ ] Basic auth habilitado
- [ ] API key con expiration
- [ ] Webhook signatures verificadas
- [ ] Environment isolation
- [ ] Resource limits configurados

## 📊 Reporting Template

```markdown
# Access Review Report - [Fecha]

## Executive Summary
- Usuarios revisados: X
- Tenants auditados: Y
- Issues encontrados: Z
- Acciones requeridas: W

## Findings

### Active Users (últimos 30 días)
| Email | Rol | Último acceso | Acción |
|-------|-----|---------------|--------|
| user1@company.com | Owner | 2024-08-12 | ✅ OK |
| user2@company.com | Admin | 2024-07-15 | ⚠️ Review |

### Inactive Users (>90 días)
| Email | Último acceso | Recomendación |
|-------|---------------|---------------|
| old@company.com | 2024-05-01 | Desactivar |

### Secret Rotation Status
| Secret | Última rotación | Estado |
|--------|----------------|---------|
| JWT_SECRET | 2024-06-01 | ⚠️ Rotar pronto |
| N8N_API_KEY | 2024-08-01 | ✅ OK |

## Action Items
| Acción | Owner | Fecha límite |
|--------|-------|--------------|
| Desactivar user old@company.com | @admin | 2024-08-20 |
| Rotar JWT_SECRET | @security | 2024-08-25 |

## Next Review
Programada para: [Primer lunes del próximo mes]
```

---
**Última actualización**: Fase 4 - Agosto 2024