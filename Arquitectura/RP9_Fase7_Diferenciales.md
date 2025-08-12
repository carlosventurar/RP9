# RP9 — Fase 7: Diferenciales (AI Assistant + SSO + Marketplace Monetizado)

## 🎯 Objetivo
Implementar las funcionalidades distintivas que separan RP9 de la competencia: AI Assistant inteligente, autenticación empresarial avanzada, y monetización completa del marketplace.

## 🏗️ Stack Tecnológico
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Netlify Functions + Supabase Edge Functions
- **Base de Datos**: Supabase PostgreSQL con RLS
- **IA**: OpenAI GPT-4 + Claude (Anthropic)
- **Auth**: Supabase Auth + SAML + TOTP
- **Pagos**: Stripe + Stripe Connect
- **Deploy**: Netlify + GitHub Actions

## 🧠 1. AI Assistant

### 1.1 Arquitectura del AI Assistant

```typescript
interface AIAssistant {
  generateWorkflow(prompt: string, context: WorkflowContext): WorkflowGeneration
  explainError(error: ExecutionError, workflow: WorkflowData): ErrorExplanation  
  optimizeWorkflow(workflow: WorkflowData): OptimizationSuggestions
  chatSupport(message: string, context: UserContext): ChatResponse
}
```

### 1.2 Funcionalidades Core

**1.2.1 Generación de Workflows**
- Prompt en español → Workflow n8n JSON completo
- Detección automática de integraciones necesarias
- Validación de estructura y mejores prácticas
- Generación de checklist de credenciales

**1.2.2 Debug Inteligente**
- Análisis de logs de error
- Sugerencias específicas de fix
- Detección de patrones comunes de fallos
- Recomendaciones de retry/backoff

**1.2.3 Optimization Engine**
- Análisis de performance
- Sugerencias de caching/batching
- Detección de cuellos de botella
- Recomendaciones de parallel processing

### 1.3 Endpoints API

```
POST /api/ai/generate-workflow
POST /api/ai/explain-error  
POST /api/ai/optimize
POST /api/ai/chat
GET  /api/ai/history
POST /api/ai/feedback
```

### 1.4 Base de Datos

```sql
-- AI Assistant Tables
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  type TEXT CHECK (type IN ('generate', 'debug', 'optimize', 'chat')),
  messages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_generated_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id),
  tenant_id UUID REFERENCES tenants(id),
  prompt TEXT NOT NULL,
  generated_json JSONB NOT NULL,
  validation_results JSONB DEFAULT '{}',
  installed BOOLEAN DEFAULT false,
  workflow_id TEXT, -- n8n workflow ID once installed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id),
  tenant_id UUID REFERENCES tenants(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔐 2. SSO & 2FA Enterprise

### 2.1 Arquitectura de Autenticación

**Niveles de Auth:**
1. **Basic**: Email/Password + Magic Link
2. **Pro**: + 2FA (TOTP)
3. **Enterprise**: + SSO (SAML/OAuth)

### 2.2 Proveedores SSO Soportados

- **Google Workspace**
- **Microsoft Azure AD**
- **Okta**
- **Auth0**
- **Generic SAML 2.0**

### 2.3 Implementación 2FA

```typescript
interface TwoFactorAuth {
  enableTOTP(userId: string): { secret: string; qrCode: string; backupCodes: string[] }
  verifyTOTP(userId: string, token: string): boolean
  generateBackupCodes(userId: string): string[]
  verifyBackupCode(userId: string, code: string): boolean
}
```

### 2.4 Base de Datos Auth

```sql
-- SSO & 2FA Tables
CREATE TABLE tenant_sso_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) UNIQUE,
  provider TEXT NOT NULL, -- 'google', 'azure', 'okta', 'saml'
  config JSONB NOT NULL, -- provider-specific config
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  totp_secret TEXT,
  backup_codes TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_token TEXT UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 💰 3. Marketplace Monetizado

### 3.1 Modelo de Revenue Sharing

**Comisiones por Tipo:**
- Templates Gratuitos: 0%
- Templates Premium ($1-$50): 30% RP9 / 70% Creator
- Templates Enterprise ($50+): 20% RP9 / 80% Creator
- Packs/Bundles: 25% RP9 / 75% Creator

### 3.2 Sistema de Payouts

**Métodos de Pago:**
- Stripe Express (Internacional)
- Transferencia bancaria (LatAm)
- PayPal (Backup)

**Ciclo de Pagos:**
- Frecuencia: Mensual
- Umbral mínimo: $50 USD
- Período de retención: 7 días

### 3.3 Analytics para Creators

```typescript
interface CreatorAnalytics {
  totalEarnings: number
  monthlyEarnings: number
  templateSales: TemplateSale[]
  topPerformingTemplates: Template[]
  customerFeedback: Review[]
  downloadStats: DownloadStat[]
}
```

### 3.4 Base de Datos Marketplace

```sql
-- Marketplace Monetization Tables
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  business_name TEXT,
  tax_id TEXT,
  payout_method TEXT CHECK (payout_method IN ('stripe', 'bank', 'paypal')),
  payout_config JSONB DEFAULT '{}',
  commission_rate DECIMAL DEFAULT 0.30,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE template_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id),
  buyer_tenant_id UUID REFERENCES tenants(id),
  creator_id UUID REFERENCES creator_profiles(id),
  price_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creator_profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_earnings_cents INTEGER NOT NULL,
  commission_deducted_cents INTEGER NOT NULL,
  net_payout_cents INTEGER NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE template_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id),
  creator_id UUID REFERENCES creator_profiles(id),
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  revenue_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, date)
);
```

## 🚀 4. Nuevas Funciones de Netlify

### 4.1 AI Functions
```
netlify/functions/
├── ai/
│   ├── generate-workflow.ts
│   ├── explain-error.ts
│   ├── optimize.ts
│   └── chat.ts
```

### 4.2 Auth Functions
```
netlify/functions/
├── auth/
│   ├── sso-config.ts
│   ├── sso-callback.ts
│   ├── 2fa-enable.ts
│   ├── 2fa-verify.ts
│   └── session-validate.ts
```

### 4.3 Marketplace Functions
```
netlify/functions/
├── marketplace/
│   ├── creator-register.ts
│   ├── payout-process.ts
│   ├── analytics-creator.ts
│   └── revenue-share.ts
```

## 📊 5. Nuevas Páginas y Componentes

### 5.1 AI Assistant UI
```
src/app/[locale]/
├── ai/
│   ├── assistant/
│   │   └── page.tsx
│   ├── history/
│   │   └── page.tsx
│   └── feedback/
│       └── page.tsx
```

### 5.2 Enterprise Auth UI
```
src/app/[locale]/
├── settings/
│   ├── sso/
│   │   └── page.tsx
│   ├── 2fa/
│   │   └── page.tsx
│   └── sessions/
│       └── page.tsx
```

### 5.3 Creator Dashboard
```
src/app/[locale]/
├── creator/
│   ├── dashboard/
│   │   └── page.tsx
│   ├── analytics/
│   │   └── page.tsx
│   ├── payouts/
│   │   └── page.tsx
│   └── templates/
│       └── manage/
│           └── page.tsx
```

## 🔧 6. Variables de Entorno Adicionales

```bash
# AI Configuration
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL_PRIMARY=gpt-4
AI_MODEL_SECONDARY=claude-3-sonnet

# SSO Configuration
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
SAML_CERTIFICATE=...

# 2FA Configuration
TOTP_ISSUER=RP9
OTP_SECRET_LENGTH=32

# Marketplace Configuration
STRIPE_CONNECT_CLIENT_ID=...
PAYOUT_MINIMUM_CENTS=5000
COMMISSION_RATE_DEFAULT=0.30
```

## 📈 7. Métricas y KPIs

### 7.1 AI Assistant Metrics
- Workflows generados por día/mes
- Tasa de éxito de generación
- Tiempo promedio de generación
- Feedback score promedio
- Errores debuggeados exitosamente

### 7.2 Enterprise Auth Metrics
- Tenants con SSO habilitado
- Usuarios con 2FA activo
- Intentos de login por método
- Sesiones activas promedio

### 7.3 Marketplace Metrics
- Revenue total por mes
- Número de creators activos
- Templates premium publicados
- Tasa de conversión premium

## 🧪 8. Testing Strategy

### 8.1 AI Testing
- Unit tests para prompt engineering
- Integration tests con APIs de IA
- Regression tests para calidad de output
- Performance tests para latencia

### 8.2 Auth Testing
- SSO flow tests por proveedor
- 2FA enrollment/verification tests
- Security penetration tests
- Session management tests

### 8.3 Marketplace Testing
- End-to-end purchase flows
- Payout processing tests
- Revenue calculation accuracy
- Creator onboarding flows

## 🚦 9. Roadmap de Implementación

### Sprint 1 (Semana 1): AI Assistant Core
- [ ] Backend functions para AI
- [ ] Base UI del Assistant
- [ ] Generación básica de workflows
- [ ] Debug de errores simple

### Sprint 2 (Semana 2): Enterprise Auth
- [ ] 2FA implementation
- [ ] SSO básico (Google/Azure)
- [ ] UI de configuración
- [ ] Session management

### Sprint 3 (Semana 3): Marketplace Monetizado
- [ ] Creator profiles
- [ ] Revenue sharing
- [ ] Payout system
- [ ] Analytics dashboard

### Sprint 4 (Semana 4): Polish & Documentation
- [ ] Testing completo
- [ ] Performance optimization
- [ ] Documentación completa
- [ ] Deploy y PR

## 📚 10. Documentación Requerida

- **AI Assistant User Guide**
- **SSO Configuration Manual**
- **Creator Marketplace Guide**
- **API Documentation**
- **Security Best Practices**
- **Deployment Guide**

---

Esta especificación define completamente la Fase 7 como el conjunto de funcionalidades distintivas que posicionan a RP9 como líder en el mercado de automatización empresarial.