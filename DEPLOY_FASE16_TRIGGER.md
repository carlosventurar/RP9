# 🚀 Deploy Fase 16 - Trigger Deploy & Verification

## ⚠️ IMPORTANTE: El código está commited pero necesita deploy

### Estado Actual
- ✅ Commit 2ff75f93 - Fase 16 Legal System completado
- ✅ 19 archivos, 4,727 líneas de código
- ❌ Deploy a Netlify pendiente
- ❌ Tests fallan con 404 (esperado hasta deploy)

## 🔄 Paso 1: Trigger Deploy en Netlify

### Opción A: Deploy Automático (Recomendado)
Netlify debería detectar automáticamente el push a main y hacer deploy.

**Verificar en:**
1. https://app.netlify.com/sites/rp9portal/deploys
2. Debería ver "Building" para commit 2ff75f93
3. Tiempo estimado: 5-8 minutos

### Opción B: Deploy Manual (Si automático falla)
1. Ir a: https://app.netlify.com/sites/rp9portal/deploys
2. Clic en **"Trigger deploy"**
3. Seleccionar **"Deploy site"**
4. Confirmar deploy

### Opción C: CLI Deploy (Último recurso)
```bash
# Si tienes Netlify CLI instalado:
netlify deploy --prod
```

## 📋 Verificar Deploy en Progreso

### En Netlify Dashboard:
1. **Deploy Status:** "Building" → "Published"
2. **Build Time:** ~5-8 minutos (más funciones = más tiempo)
3. **Functions Deployed:** Debería mostrar 7 nuevas funciones legales

### Logs a Revistar:
- ✅ "Installing dependencies"
- ✅ "Building Next.js app"  
- ✅ "Deploying functions"
- ✅ "Processing templates/legal/*"
- ✅ "Site published"

### Nuevas Functions Esperadas:
- `legal-accept`
- `legal-generate`
- `contracts-create`
- `contracts-sign-webhook`
- `subprocessors-manage`
- `sla-credit-calc`

## 🧪 Post-Deploy Testing

### Test 1: Verificar Páginas Legales
```bash
# Manualmente en browser:
https://rp9portal.netlify.app/es-MX/legal/tos
https://rp9portal.netlify.app/es-MX/legal/privacy
https://rp9portal.netlify.app/es-MX/legal/status
```

**Resultado esperado:** Páginas cargan sin 404

### Test 2: Ejecutar Script Automático
```bash
cd D:\OneDrive\Code\RP9
node scripts/test-fase16-legal.js
```

**Resultado esperado:** Al menos 70% tests pasan

### Test 3: Function Health Check
```bash
# Test función básica:
curl https://rp9portal.netlify.app/.netlify/functions/subprocessors-manage
```

**Resultado esperado:** JSON response, no 404

## 🚨 Troubleshooting Deploy

### Error: "Build failed"
**Causa más común:** Missing dependencies
**Solución:**
1. Revisar build logs en Netlify
2. Verificar package.json tiene todas las deps
3. Confirmar no hay syntax errors en functions

### Error: "Function timeout"
**Causa:** Función demasiada pesada para cold start
**Solución:**
1. Optimizar imports en functions
2. Aumentar timeout en netlify.toml si necesario

### Error: "Missing environment variables"
**Causa:** Variables no configuradas en Netlify
**Solución:**
1. Seguir instrucciones DEPLOY_FASE16_NETLIFY.md
2. Trigger redeploy después de configurar variables

### Warning: "Templates not found"
**Causa:** Carpeta templates/legal/ no incluida en build
**Solución:**
1. Verificar templates/ está en repo
2. Confirmar no está en .gitignore
3. Check build output incluye templates

## ✅ Checklist Post-Deploy

- [ ] Deploy status = "Published"
- [ ] Build time < 10 minutos
- [ ] 7 funciones legales deployed
- [ ] Páginas /legal/* cargan sin 404
- [ ] Test script pasa >70% tests
- [ ] No errores críticos en logs
- [ ] Functions responden con JSON, no HTML errors

## 📊 Success Metrics

### Deploy Success:
- **Build time:** < 10 minutes
- **Functions deployed:** 7/7
- **Pages accessible:** 3/3 legal pages
- **Test success rate:** >70%

### Function Performance:
- **Cold start:** < 5 seconds
- **Warm response:** < 1 second
- **Error rate:** < 5%

## 🔄 Si Deploy Falla Completamente

### Plan B: Rollback
```bash
# Revert to last working state:
git revert 2ff75f93
git push origin main
```

### Plan C: Debug Local
```bash
# Test functions locally:
netlify dev
# Then test endpoints on localhost:8888
```

---

**⏱️ Tiempo Estimado Total:** 15-20 minutos

**🎯 Objetivo:** Deploy exitoso con funciones legales operativas

**✅ Éxito:** Tests end-to-end pasan y sistema legal funciona en producción