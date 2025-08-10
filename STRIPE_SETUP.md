# 🚀 Stripe Setup Guide - RP9 Portal

## 📋 **Setup Checklist**

### 1. **Crear Cuenta Stripe**
- [ ] Ir a https://dashboard.stripe.com/register
- [ ] Crear cuenta con email corporativo
- [ ] Activar **modo Test** (importante para desarrollo)

### 2. **Obtener API Keys**
- [ ] Ir a https://dashboard.stripe.com/test/apikeys
- [ ] Copiar **Publishable key** (`pk_test_...`)
- [ ] Copiar **Secret key** (`sk_test_...`)

### 3. **Configurar Environment Variables**

Agregar a tu archivo `.env.local` (y en Netlify):

```bash
# Stripe Configuration (TEST MODE)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://rp99.netlify.app
```

### 4. **Crear Productos y Precios**

#### Opción A: Script Automático (Recomendado)
```bash
cd scripts
node setup-stripe-products.js
```

#### Opción B: Manual en Dashboard
1. Ir a https://dashboard.stripe.com/test/products
2. Crear 3 productos:

**Plan Inicial:**
- Nombre: Plan Inicial RP9
- Precio: $19.00 USD/mes (recurring)
- Descripción: 1,000 ejecuciones por mes

**Plan Profesional:**  
- Nombre: Plan Profesional RP9
- Precio: $49.00 USD/mes (recurring)
- Descripción: 10,000 ejecuciones por mes

**Plan Empresarial:**
- Nombre: Plan Empresarial RP9  
- Precio: $199.00 USD/mes (recurring)
- Descripción: Ejecuciones ilimitadas

### 5. **Actualizar Base de Datos**

Una vez que tengas los Price IDs de Stripe:

1. Editar `supabase/migrations/002_update_stripe_price_ids.sql`
2. Reemplazar los price IDs placeholder con los reales
3. Ejecutar migración en Supabase

```sql
-- Ejemplo con price IDs reales:
UPDATE plans SET stripe_price_id = 'price_1P7QbABc7Cx0123456789' WHERE key = 'starter';
UPDATE plans SET stripe_price_id = 'price_1P7QbBBc7Cx0987654321' WHERE key = 'pro';  
UPDATE plans SET stripe_price_id = 'price_1P7QbCBc7Cx0555555555' WHERE key = 'enterprise';
```

### 6. **Configurar Webhooks**

1. Ir a https://dashboard.stripe.com/test/webhooks
2. Crear endpoint: `https://rp99.netlify.app/api/stripe-webhook`
3. Seleccionar eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`  
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copiar **Webhook secret** (`whsec_...`)

### 7. **Deploy Variables**

En Netlify (Site settings → Environment variables):
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://rp99.netlify.app
```

### 8. **Testing**

1. **Test básico:**
   ```bash
   npm run dev
   # Ir a http://localhost:3000/billing
   # Intentar upgrade a plan Pro
   ```

2. **Cards de prueba Stripe:**
   - Successful: 4242 4242 4242 4242
   - Declined: 4000 0000 0000 0002
   - Cualquier fecha futura, cualquier CVC

3. **Verificar webhook:**
   - Completar compra de prueba
   - Verificar en Stripe Dashboard → Webhooks → Attempts
   - Verificar en Supabase que se creó record en `subscriptions`

## 🎯 **Arquitectura de Billing**

```mermaid
graph TD
    A[Usuario clica 'Upgrade'] --> B[Frontend]
    B --> C[/api/billing-checkout]
    C --> D[Stripe Checkout Session]
    D --> E[Usuario paga con tarjeta]
    E --> F[Stripe Webhook] 
    F --> G[/api/stripe-webhook]
    G --> H[Update Supabase]
    H --> I[Usuario ve plan activo]
```

## 🔧 **Troubleshooting**

### Error: "No price ID found"
- Verificar que los price IDs en la base de datos son correctos
- Verificar que los productos están en modo Test

### Error: "Webhook signature failed"
- Verificar STRIPE_WEBHOOK_SECRET
- Verificar que el endpoint URL es correcto en Stripe

### Error: "Customer not found"
- Verificar que se está creando customer en checkout
- Verificar que el metadata contiene tenant_id

## 📈 **Próximos Pasos**

Después de configurar Stripe:
- [ ] Probar flujo completo de subscription
- [ ] Implementar usage collector (Sprint 2)
- [ ] Configurar billing enforcement 
- [ ] Preparar para modo Production

---

## ⚠️ **IMPORTANTE:**

- **NUNCA** commits las API keys al repositorio
- **SIEMPRE** usar modo Test durante desarrollo  
- **VERIFICAR** que los webhooks funcionan antes de production
- **BACKUP** de datos antes de migraciones