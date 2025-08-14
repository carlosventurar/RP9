# ⏰ Deploy Fase 16 - Scheduled Functions Verification

## 🔍 Estado de Scheduled Functions

### Función SLA Credit Calculation
**Archivo:** `netlify/functions/sla-credit-calc.ts`  
**Schedule:** Monthly on 1st at 06:00 UTC (`0 6 1 * *`)  
**Propósito:** Calcular créditos automáticos por SLA breach

## 📋 Verificación en Netlify

### 1. Verificar Configuración en netlify.toml
```toml
# Scheduled Functions - Fase 16: Legal & Compliance
[functions.sla-credit-calc]
  schedule = "0 6 1 * *"    # Monthly on 1st at 06:00 UTC
```
✅ **Status:** Configurado en netlify.toml

### 2. Verificar Deploy de Function
**En Netlify Dashboard:**
1. Ir a: https://app.netlify.com/sites/rp9portal/functions
2. Buscar función: `sla-credit-calc`
3. Verificar estado: "Active"

### 3. Verificar Schedule en Dashboard
**En Functions → Scheduled Functions:**
- Debería aparecer `sla-credit-calc`
- Schedule: "0 6 1 * *"
- Next run: 1st del próximo mes a las 06:00 UTC

## 🧪 Testing Manual de Scheduled Function

### Test 1: Trigger Manual
```bash
# Test POST directo:
curl -X POST https://rp9portal.netlify.app/.netlify/functions/sla-credit-calc \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resultado esperado:**
```json
{
  "success": true,
  "summary": {
    "total_tenants": 0,
    "credits_applied": 0,
    "errors": 0,
    "period": "2025-07"
  }
}
```

### Test 2: Function Logs
**En Netlify Dashboard:**
1. Functions → `sla-credit-calc` → Logs
2. Ejecutar trigger manual
3. Verificar logs sin errores

### Test 3: Database Verification
**En Supabase:**
```sql
-- Verificar que la función puede conectar a DB:
SELECT COUNT(*) FROM tenants;

-- Verificar tabla SLA metrics existe:
SELECT COUNT(*) FROM sla_metrics;

-- Verificar tabla SLA credits existe:
SELECT COUNT(*) FROM sla_credits;
```

## 📊 Datos de Prueba para SLA

### Crear Tenant Test
```sql
INSERT INTO tenants (id, name, plan, status) 
VALUES ('test-tenant-sla', 'Test SLA Tenant', 'pro', 'active');
```

### Crear Métricas SLA Mock
```sql
-- Insertar métricas del mes pasado con uptime <99.9%
INSERT INTO sla_metrics (tenant_id, metric_date, uptime_percentage, total_downtime_minutes) 
VALUES 
  ('test-tenant-sla', '2025-07-01', 98.5, 216),  -- Should trigger 10% credit
  ('test-tenant-sla', '2025-07-02', 99.1, 130),
  ('test-tenant-sla', '2025-07-03', 99.8, 29);
```

### Trigger Function y Verificar Crédito
```bash
# Ejecutar función:
curl -X POST https://rp9portal.netlify.app/.netlify/functions/sla-credit-calc

# Verificar en Supabase:
SELECT * FROM sla_credits WHERE tenant_id = 'test-tenant-sla';
```

**Resultado esperado:**
- Credit percentage: 10% (por uptime promedio ~99.1%)
- Status: 'calculated' o 'applied'

## ⚙️ Configuración Adicional

### Variables de Entorno Requeridas
```bash
# Para scheduled functions:
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Para créditos Stripe (opcional):
STRIPE_SECRET_KEY="sk_live_..."
```

### Timeouts y Limites
```toml
# En netlify.toml si necesario:
[functions.sla-credit-calc]
  schedule = "0 6 1 * *"
  timeout = 300  # 5 minutos max
```

## 🚨 Troubleshooting

### Error: "Function not found"
**Causa:** Function no deployed correctamente
**Solución:**
1. Verificar archivo existe: `netlify/functions/sla-credit-calc.ts`
2. Trigger redeploy
3. Check build logs para errores

### Error: "Database connection failed"
**Causa:** Variables Supabase incorrectas
**Solución:**
1. Verificar SUPABASE_SERVICE_ROLE_KEY
2. Testear conexión desde otra función

### Error: "Timeout"
**Causa:** Función toma demasiado tiempo
**Solución:**
1. Optimizar queries SQL
2. Aumentar timeout en netlify.toml
3. Procesar en batches más pequeños

### Warning: "No tenants found"
**Causa:** Tabla tenants vacía (normal en testing)
**Solución:**
1. Insertar tenant de prueba
2. Verificar que función retorna success=true

## 📅 Schedule Verification

### Próxima Ejecución
**Cálculo manual:**
- Schedule: `0 6 1 * *`
- Significado: Minuto 0, Hora 6, Día 1, Cualquier mes, Cualquier día semana
- Próxima: 1ro de septiembre 2025 a las 06:00 UTC

### Zona Horaria
- **UTC:** 06:00
- **CDMX (GMT-6):** 00:00 (medianoche)
- **Madrid (GMT+1):** 07:00

### Verificar Cron Expression
```bash
# Online cron validator:
# https://crontab.guru/#0_6_1_*_*
# Should show: "At 06:00 on day-of-month 1"
```

## ✅ Checklist Scheduled Functions

### Pre-Deploy
- [✅] Function file exists: `sla-credit-calc.ts`
- [✅] Schedule in netlify.toml: `0 6 1 * *`
- [✅] Dependencies imported correctly
- [✅] Error handling implemented

### Post-Deploy
- [ ] Function appears in Netlify dashboard
- [ ] Schedule configured correctly
- [ ] Manual trigger works
- [ ] Database connection successful
- [ ] SLA calculation logic working
- [ ] Logs show no errors

### Production Ready
- [ ] Test data creates expected credits
- [ ] Function handles no-data gracefully
- [ ] Error notifications working
- [ ] Performance acceptable (<5 min)

## 📞 Monitoring & Alerts

### Recommended Monitoring
1. **Function execution logs** (Netlify)
2. **Database query performance** (Supabase)
3. **SLA credit accuracy** (manual review)
4. **Email notifications** for failures

### Alert Setup
```javascript
// En función sla-credit-calc.ts ya incluido:
console.log('SLA Credit Calculation completed:', summary)
console.error('SLA Credit Calculation failed:', error)
```

---

**⏱️ Próxima ejecución automática:** 1 septiembre 2025, 06:00 UTC

**🎯 Objetivo:** Créditos SLA automáticos funcionando sin intervención manual

**✅ Éxito:** Function ejecuta mensualmente y calcula créditos correctos