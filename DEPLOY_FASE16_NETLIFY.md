# 🔧 Deploy Fase 16 - Configuración Netlify Variables

## ⚠️ CONFIGURAR EN NETLIFY PRODUCCIÓN

### Acceso a Configuración
1. Ir a: https://app.netlify.com/sites/agentevirtualia/settings/deploys
2. Navegar a **Environment variables**
3. Agregar las siguientes variables nuevas para Fase 16

## 🔑 Variables de Entorno Críticas

### 1. Legal System Core
```bash
# Seguridad HMAC para webhooks
HMAC_SECRET="fase16_legal_hmac_256bit_secret_key_2025"

# Webhook de firma de documentos (DocuSign simulado)
SIGN_WEBHOOK_SECRET="docusign_webhook_secret_fase16_rp9_2025"

# Base URL para documentos generados
DOCS_BASE_URL="https://documents.agentevirtualia.com"
```

### 2. Email Service (Notificaciones Subprocesadores)
```bash
# Resend API para emails de notificación
RESEND_API_KEY="re_your_production_resend_api_key"

# Alternativamente, si usas SendGrid:
# SENDGRID_API_KEY="SG.your_sendgrid_production_key"
```

### 3. Verificar Variables Existentes
**Estas deben estar configuradas ya (Fase 15):**
```bash
# Supabase Production
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Stripe Production
STRIPE_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## 📋 Instrucciones Paso a Paso

### En Netlify Dashboard:

1. **Site settings** → **Environment variables**

2. **Add variable** para cada una:

   **Variable 1:**
   - Key: `HMAC_SECRET`
   - Value: `fase16_legal_hmac_256bit_secret_key_2025`
   - Scopes: ✅ Builds ✅ Functions

   **Variable 2:**
   - Key: `SIGN_WEBHOOK_SECRET`
   - Value: `docusign_webhook_secret_fase16_rp9_2025`
   - Scopes: ✅ Builds ✅ Functions

   **Variable 3:**
   - Key: `DOCS_BASE_URL`
   - Value: `https://documents.agentevirtualia.com`
   - Scopes: ✅ Builds ✅ Functions

   **Variable 4:**
   - Key: `RESEND_API_KEY`
   - Value: `re_your_production_resend_api_key`
   - Scopes: ✅ Functions

3. **Save changes**

4. **Trigger new deploy** para aplicar variables:
   - Deploys → Trigger deploy → Deploy site

## 🔒 Generación de Secretos Seguros

### Para HMAC_SECRET (256-bit)
```bash
# En terminal local:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Para SIGN_WEBHOOK_SECRET
```bash
# En terminal local:
node -e "console.log('docusign_' + require('crypto').randomBytes(16).toString('hex'))"
```

## 🧪 Verificación de Variables

### Método 1: Test Function
Crear función temporal para verificar variables:

```javascript
// test-env.js (temporary)
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      hmac_secret_exists: !!process.env.HMAC_SECRET,
      sign_secret_exists: !!process.env.SIGN_WEBHOOK_SECRET,
      docs_url_exists: !!process.env.DOCS_BASE_URL,
      resend_key_exists: !!process.env.RESEND_API_KEY,
      supabase_url_exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL
    })
  }
}
```

### Método 2: Deploy Logs
Verificar en deploy logs que no hay errores de variables faltantes.

### Método 3: Function Test
```bash
# Test endpoint legal básico:
curl https://agentevirtualia.netlify.app/.netlify/functions/legal-accept \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return 400 (validation error) not 500 (missing env var)
```

## 📧 Configuración Email Service

### Opción A: Resend (Recomendado)
1. Crear cuenta en https://resend.com
2. Verificar dominio `agentevirtualia.com`
3. Generar API key de producción
4. Configurar `RESEND_API_KEY`

### Opción B: SendGrid
1. Cuenta SendGrid verificada
2. API key con permisos de envío
3. Configurar `SENDGRID_API_KEY`

### Templates de Email Requeridos
- **Subprocessor Addition**: Notificación nuevo subprocesador
- **Subprocessor Modification**: Cambios en subprocesador existente
- **Subprocessor Removal**: Eliminación de subprocesador

## ✅ Checklist de Configuración

- [ ] HMAC_SECRET configurado (32 bytes hex)
- [ ] SIGN_WEBHOOK_SECRET configurado
- [ ] DOCS_BASE_URL configurado
- [ ] RESEND_API_KEY configurado
- [ ] Variables Supabase verificadas
- [ ] Variables Stripe verificadas
- [ ] Deploy triggered exitosamente
- [ ] Test básico de función legal successful
- [ ] No errores en deploy logs

## 🚨 Troubleshooting

### Error: "Environment variable not found"
- Verificar spelling exacto de variable
- Confirmar que está en scopes correctos (Functions)
- Trigger new deploy después de cambios

### Error: "Invalid API key"
- Verificar que RESEND_API_KEY es de producción
- Verificar formato: debe empezar con "re_"
- Testear key en Resend dashboard

### Error: "HMAC verification failed"
- Verificar que HMAC_SECRET es idéntico entre cliente/servidor
- Confirmar encoding hexadecimal correcto

## 📞 Soporte Email Service

**Resend:**
- Dashboard: https://resend.com/domains
- Docs: https://resend.com/docs
- Support: support@resend.com

**SendGrid:**
- Dashboard: https://app.sendgrid.com
- Docs: https://docs.sendgrid.com
- Support: support@sendgrid.com

---

**⚠️ CRÍTICO:** Sin estas variables, las funciones legales fallarán en producción.

**✅ ÉXITO:** Deploy automático aplicará las nuevas variables a todas las funciones Netlify.