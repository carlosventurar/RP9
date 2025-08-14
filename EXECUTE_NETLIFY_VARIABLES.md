# 🔧 EJECUTAR AHORA: Variables Entorno Netlify - Fase 16

## ⚠️ CONFIGURAR EN NETLIFY PRODUCCIÓN

### 🎯 Acceso Directo
**URL:** https://app.netlify.com/sites/rp9portal/settings/deploys#environment-variables

## 🔑 VALORES GENERADOS PARA COPIAR

### ✅ Variable 1: HMAC_SECRET
```
Key: HMAC_SECRET
Value: 4b35315580024c90fbea0090e7cfc95a7c0b900ef59ef117a4578de69efb5b24
Scopes: ✅ Builds ✅ Functions
```

### ✅ Variable 2: SIGN_WEBHOOK_SECRET
```
Key: SIGN_WEBHOOK_SECRET
Value: docusign_a570d2154fe8c6438c34036059283fec
Scopes: ✅ Builds ✅ Functions
```

### ✅ Variable 3: DOCS_BASE_URL
```
Key: DOCS_BASE_URL
Value: https://documents.rp9portal.com
Scopes: ✅ Builds ✅ Functions
```

### ✅ Variable 4: RESEND_API_KEY
```
Key: RESEND_API_KEY
Value: re_your_production_resend_api_key
Scopes: ✅ Functions
```

## 📋 INSTRUCCIONES EJECUTAR AHORA

### 1. Acceder a Netlify
1. **Abrir:** https://app.netlify.com/sites/rp9portal/settings/deploys
2. **Scroll down** hasta "Environment variables" 
3. **Clic** en "Add variable"

### 2. Agregar Variables (UNA POR UNA)

**Variable 1:**
- Key: `HMAC_SECRET`
- Value: `4b35315580024c90fbea0090e7cfc95a7c0b900ef59ef117a4578de69efb5b24`
- ✅ Builds ✅ Functions
- **Clic "Save"**

**Variable 2:**
- Key: `SIGN_WEBHOOK_SECRET`  
- Value: `docusign_a570d2154fe8c6438c34036059283fec`
- ✅ Builds ✅ Functions
- **Clic "Save"**

**Variable 3:**
- Key: `DOCS_BASE_URL`
- Value: `https://documents.rp9portal.com`
- ✅ Builds ✅ Functions  
- **Clic "Save"**

**Variable 4:**
- Key: `RESEND_API_KEY`
- Value: `re_your_production_resend_api_key`
- ✅ Functions
- **Clic "Save"**

### 3. Trigger Deploy
1. **Ir a:** Deploys tab
2. **Clic:** "Trigger deploy" 
3. **Seleccionar:** "Deploy site"
4. **Esperar:** Build completo (5-8 minutos)

## ✅ Verificación Inmediata

### Test Variables Configuradas
```bash
# Test endpoint básico (después del deploy):
curl https://rp9portal.netlify.app/.netlify/functions/legal-accept \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}'

# Debe retornar 400 (validation error) NO 500 (missing env var)
```

### Verificar Deploy Logs
1. **Netlify Dashboard** → **Deploys** 
2. **Ver último deploy** → **Deploy log**
3. **Buscar errores:** "Environment variable" o "undefined"

## 🚨 Si Falta RESEND_API_KEY Real

### Opción A: Configurar Resend (Recomendado)
1. **Crear cuenta:** https://resend.com
2. **Verificar dominio:** rp9portal.com  
3. **Crear API key:** Dashboard → API Keys → Create
4. **Actualizar variable:** `RESEND_API_KEY=re_actual_key`

### Opción B: Usar Placeholder (Temporal)
- **Mantener:** `re_your_production_resend_api_key`
- **Nota:** Functions de email fallarán hasta configurar real

## 📊 Criterios de Éxito

- [x] 4 variables agregadas en Netlify
- [x] Deploy triggered exitosamente  
- [x] Build completo sin errores env
- [x] Functions responden (no 500 por missing vars)
- [x] Logs sin "Environment variable not found"

## ⏱️ Tiempo Total: 10-15 minutos

---

**🎯 SIGUIENTE:** Una vez completado, ejecutar testing end-to-end

**✅ ÉXITO:** Todas las functions legales tendrán acceso a variables críticas