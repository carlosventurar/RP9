# 🚀 Checklist de Deploy - Fase 15: Internacionalización LatAm-first

## ✅ Pasos Completados

### 1. Código y Testing
- [x] Implementación completa de 12 componentes principales
- [x] Tests unitarios pasando (28/28 tests)
- [x] Tests E2E de checkout pasando (14/14 tests)
- [x] Build exitoso de Next.js
- [x] Script de migración de Supabase creado

### 2. Configuración Base
- [x] Variables de entorno configuradas (.env)
- [x] Netlify.toml actualizado con nuevas funciones scheduled
- [x] Jest configuración arreglada para next-intl
- [x] Script de testing de endpoints creado

## 🔄 Pasos Pendientes para Producción

### 3. Configuración de Base de Datos (CRÍTICO)

**3.1 Ejecutar Migraciones en Supabase**
```bash
# Ir a https://app.supabase.com/project/YOUR_PROJECT_ID/sql
# Copiar y ejecutar el contenido completo de MANUAL_MIGRATIONS_FASE15.sql
```

**3.2 Verificar Tablas Creadas**
- [ ] `country_configs` (7 países configurados)
- [ ] `price_books` (precios para 2 planes x 7 países)
- [ ] `country_feature_flags` (métodos de pago por país)
- [ ] `tenant_feature_flags` (overrides por cliente)
- [ ] `i18n_messages` (mensajes base)
- [ ] `billing_events` (tracking de analytics)
- [ ] `tax_rules` (configuración fiscal)

### 4. Configuración de Stripe (CRÍTICO)

**4.1 Crear Products y Prices en Stripe Dashboard**

Para cada país, crear los siguientes price IDs:

**México (MXN):**
- [ ] `price_mx_starter_monthly` → $999 MXN
- [ ] `price_mx_starter_yearly` → $7,992 MXN  
- [ ] `price_mx_pro_monthly` → $1,999 MXN
- [ ] `price_mx_pro_yearly` → $15,990 MXN

**Colombia (COP):**
- [ ] `price_co_starter_monthly` → $99,000 COP
- [ ] `price_co_starter_yearly` → $799,000 COP
- [ ] `price_co_pro_monthly` → $199,000 COP
- [ ] `price_co_pro_yearly` → $1,590,000 COP

**Chile (CLP):**
- [ ] `price_cl_starter_monthly` → $19,900 CLP
- [ ] `price_cl_starter_yearly` → $159,000 CLP
- [ ] `price_cl_pro_monthly` → $39,900 CLP
- [ ] `price_cl_pro_yearly` → $319,000 CLP

**Perú (PEN):**
- [ ] `price_pe_starter_monthly` → S/99 PEN
- [ ] `price_pe_starter_yearly` → S/790 PEN
- [ ] `price_pe_pro_monthly` → S/199 PEN
- [ ] `price_pe_pro_yearly` → S/1,590 PEN

**Argentina (ARS):**
- [ ] `price_ar_starter_monthly` → $9,990 ARS
- [ ] `price_ar_starter_yearly` → $79,900 ARS
- [ ] `price_ar_pro_monthly` → $19,990 ARS
- [ ] `price_ar_pro_yearly` → $159,900 ARS

**República Dominicana (DOP):**
- [ ] `price_do_starter_monthly` → RD$1,499 DOP
- [ ] `price_do_starter_yearly` → RD$11,990 DOP
- [ ] `price_do_pro_monthly` → RD$2,999 DOP
- [ ] `price_do_pro_yearly` → RD$23,990 DOP

**Estados Unidos (USD):**
- [ ] `price_us_starter_monthly` → $49 USD
- [ ] `price_us_starter_yearly` → $390 USD
- [ ] `price_us_pro_monthly` → $99 USD
- [ ] `price_us_pro_yearly` → $790 USD

### 5. Variables de Entorno en Netlify

**5.1 Variables Críticas (copiar de .env)**
```bash
# I18n
NEXT_PUBLIC_DEFAULT_LOCALE=es-419
NEXT_PUBLIC_SUPPORTED_LOCALES=es-419,es-MX,es-CO,es-CL,es-PE,es-AR,es-DO,en-US
ENABLE_FEATURE_FLAGS=true
ENABLE_MULTI_CURRENCY=true

# Supabase (usar credenciales de producción)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key

# Stripe (usar credenciales LIVE)
STRIPE_SECRET_KEY=sk_live_your_live_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook
```

### 6. Deploy y Verificación

**6.1 Deploy a Netlify**
```bash
git add .
git commit -m "feat: Fase 15 ready for production deployment"
git push origin main
```

**6.2 Verificación Post-Deploy**
- [ ] Sitio cargas correctamente en rp9.io
- [ ] Middleware detecta países correctamente
- [ ] Price lookup funciona: `/api/pricebook?country=MX&plan=starter`
- [ ] Checkout funciona con monedas locales
- [ ] Feature flags responden correctamente
- [ ] Export de i18n funciona: `/api/i18n/export`

### 7. Testing de Producción

**7.1 Probar Flujos por País**

**México:**
- [ ] Visitar rp9.io/mx → redirecciona a /es-MX
- [ ] Precios se muestran en pesos mexicanos ($999 MXN)
- [ ] Toggle USD ↔ MXN funciona
- [ ] Checkout muestra OXXO + tarjeta
- [ ] Campo RFC aparece y valida

**Colombia:**
- [ ] Visitar rp9.io/co → redirecciona a /es-CO  
- [ ] Precios se muestran en pesos colombianos ($199,000 COP)
- [ ] Checkout muestra PSE + tarjeta
- [ ] Campo NIT aparece y valida

**Chile:**
- [ ] Visitar rp9.io/cl → redirecciona a /es-CL
- [ ] Precios se muestran en pesos chilenos ($39,900 CLP)
- [ ] Checkout muestra precio neto (sin IVA)
- [ ] Campo RUT aparece y valida

**7.2 Probar Analytics**
- [ ] Dashboard muestra métricas normalizadas en USD
- [ ] Filtros por país funcionan
- [ ] Exportación de reportes multi-moneda

### 8. Monitoreo y Alertas

**8.1 Configurar Alertas**
- [ ] Slack webhook configurado para errores de pricing
- [ ] Alertas de conversión por país
- [ ] Monitoreo de rate de checkout exitoso

**8.2 Métricas a Vigilar (Primeras 48 horas)**
- [ ] Conversion rate por país (meta: +25% vs USD-only)
- [ ] Bounce rate en pricing (meta: -30%)
- [ ] Payment success rate (meta: +40% con métodos locales)
- [ ] Errores de API precio lookup (<1%)

## 🎯 KPIs de Éxito Fase 15

### Semana 1
- [ ] Al menos 50% del tráfico LatAm usa moneda local
- [ ] Reducción 20%+ en bounce rate de pricing 
- [ ] Incremento 15%+ en rate de checkout iniciado

### Mes 1
- [ ] Conversión general +25% vs período anterior
- [ ] Al menos 1 transacción exitosa en cada país soportado
- [ ] Customer satisfaction 4.0+ por país

## 🚨 Plan de Rollback

**Si hay problemas críticos:**

1. **Rollback Inmediato** (5 min):
   ```bash
   # Deshabilitar feature flags
   ENABLE_MULTI_CURRENCY=false
   ENABLE_FEATURE_FLAGS=false
   ```

2. **Rollback Parcial** (15 min):
   - Revertir middleware a detección simple
   - Forzar todos los precios a USD
   - Deshabilitar métodos de pago locales

3. **Rollback Completo** (30 min):
   - Revertir a commit anterior: `f0ce2f95`
   - Restaurar variables de entorno anteriores

## 📞 Contactos de Emergencia

- **Tech Lead**: tech-lead@rp9portal.com
- **DevOps**: devops@rp9portal.com  
- **Stripe Support**: dashboard.stripe.com/support
- **Supabase Support**: supabase.com/support

---

**🎉 ¡Fase 15 lista para transformar RP9 Portal en la plataforma LatAm-first más nativa del mercado!**