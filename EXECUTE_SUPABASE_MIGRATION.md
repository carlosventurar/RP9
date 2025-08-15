# 🗄️ EJECUTAR AHORA: Migración Supabase Fase 16

## ⚠️ IMPORTANTE: Ejecutar en Supabase PRODUCCIÓN

### 📋 Instrucciones Paso a Paso

#### 1. Acceder a Supabase Dashboard
1. Abrir: https://app.supabase.com/projects
2. **Seleccionar proyecto Agente Virtual IA PRODUCCIÓN** (verificar nombre/URL)
3. Clic en **SQL Editor** en sidebar izquierdo

#### 2. Preparar Migración
1. Clic en **"New query"**
2. Nombrar: "Fase 16 - Legal System Migration"

#### 3. Copiar Contenido SQL Completo
**Archivo fuente:** `supabase/migrations/093_legal_system.sql`

**COPIAR TODO este contenido SQL (557 líneas):**

```sql
-- Fase 16: Legal & Compliance System
-- Migration: 093_legal_system.sql
-- Date: 2025-08-14

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================
-- 1. LEGAL DOCUMENTS TABLE
-- ===================================
CREATE TABLE legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type VARCHAR(50) NOT NULL, -- 'tos', 'privacy', 'msa', 'dpa', 'sla'
  version VARCHAR(20) NOT NULL,
  language VARCHAR(10) NOT NULL, -- 'es', 'en'
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown/HTML content
  template_variables JSONB DEFAULT '{}', -- Variables for handlebars
  requires_signature BOOLEAN DEFAULT false,
  jurisdiction VARCHAR(50) DEFAULT 'CDMX, Mexico',
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'archived'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ===================================
-- 2. LEGAL ACCEPTANCES TABLE
-- ===================================
CREATE TABLE legal_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_version VARCHAR(20) NOT NULL,
  language VARCHAR(10) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- For periodic re-acceptance
  metadata JSONB DEFAULT '{}' -- Additional context
);

-- ===================================
-- 3. CONTRACTS TABLE (MSA/DPA/SLA)
-- ===================================
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  contract_type VARCHAR(50) NOT NULL, -- 'msa', 'dpa', 'sla'
  title TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'signed', 'terminated'
  template_id UUID REFERENCES legal_documents(id),
  variables JSONB NOT NULL DEFAULT '{}', -- Contract-specific variables
  generated_content TEXT, -- Final generated content
  pdf_url TEXT, -- URL to generated PDF
  html_url TEXT, -- URL to HTML version
  signature_request_id TEXT, -- External signing service ID
  signed_at TIMESTAMP WITH TIME ZONE,
  signed_by_name TEXT,
  signed_by_email TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT true,
  renewal_notice_days INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ===================================
-- 4. SUBPROCESSORS TABLE
-- ===================================
CREATE TABLE subprocessors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT NOT NULL, -- What service they provide
  data_categories TEXT[], -- Types of data they process
  location TEXT NOT NULL, -- Where they operate
  certification TEXT[], -- SOC2, ISO27001, etc.
  website_url TEXT,
  privacy_policy_url TEXT,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'deprecated'
  added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reviewed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- 5. SUBPROCESSOR SUBSCRIPTIONS TABLE
-- ===================================
CREATE TABLE subprocessor_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  email TEXT NOT NULL,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  notification_preferences JSONB DEFAULT '{"email": true, "webhook": false}',
  UNIQUE(tenant_id, email)
);

-- ===================================
-- 6. INCIDENTS TABLE
-- ===================================
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL, -- 'P1', 'P2', 'P3'
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'closed'
  affected_services TEXT[], -- Services impacted
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  resolution_summary TEXT,
  rca_url TEXT, -- Root Cause Analysis document
  public BOOLEAN DEFAULT true, -- Show on status page
  estimated_resolution TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ===================================
-- 7. MAINTENANCES TABLE
-- ===================================
CREATE TABLE maintenances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  maintenance_type VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'emergency'
  affected_services TEXT[],
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
  advance_notice_hours INTEGER DEFAULT 24,
  public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ===================================
-- 8. SLA METRICS TABLE
-- ===================================
CREATE TABLE sla_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  metric_date DATE NOT NULL,
  uptime_percentage DECIMAL(5,3) NOT NULL, -- 99.999 format
  total_downtime_minutes INTEGER DEFAULT 0,
  incident_count INTEGER DEFAULT 0,
  planned_downtime_minutes INTEGER DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, metric_date)
);

-- ===================================
-- 9. SLA CREDITS TABLE
-- ===================================
CREATE TABLE sla_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  sla_percentage DECIMAL(5,3) NOT NULL,
  target_sla DECIMAL(5,3) DEFAULT 99.9,
  credit_percentage DECIMAL(5,2) DEFAULT 0, -- 0.00 to 100.00
  credit_amount_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'calculated', -- 'calculated', 'applied', 'expired'
  stripe_credit_id TEXT, -- Stripe coupon/credit note ID
  applied_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, billing_period_start, billing_period_end)
);

-- ===================================
-- 10. RETENTION POLICIES TABLE
-- ===================================
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  plan_tier VARCHAR(20) NOT NULL, -- 'starter', 'pro', 'enterprise'
  logs_retention_days INTEGER NOT NULL,
  execution_history_days INTEGER NOT NULL,
  financial_evidence_years INTEGER NOT NULL,
  backup_retention_days INTEGER DEFAULT 30,
  gdpr_deletion_days INTEGER DEFAULT 30,
  effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, country_code)
);

-- ÍNDICES, RLS, FUNCIONES, TRIGGERS, SEED DATA...
-- [Continuar con resto del archivo completo]
```

#### 4. EJECUTAR Migración
1. **Pegar todo el contenido** en el editor SQL
2. **Verificar** que es el proyecto CORRECTO
3. Clic en **"RUN"** o **"Execute"**
4. **Esperar** ejecución completa (1-2 minutos)

#### 5. VERIFICAR Éxito
**Ejecutar esta query de verificación:**

```sql
-- VERIFICACIÓN INMEDIATA:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'legal_documents', 'legal_acceptances', 'contracts', 
  'subprocessors', 'subprocessor_subscriptions', 'incidents', 
  'maintenances', 'sla_metrics', 'sla_credits', 'retention_policies'
);
```

**Resultado esperado:** 10 filas con nombres de tablas

**Verificar funciones SQL:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('calculate_sla_credit', 'get_latest_legal_document', 'user_has_accepted_latest_tos');
```

**Resultado esperado:** 3 filas con nombres de funciones

## ✅ Criterio de Éxito Paso 1
- [x] 10 tablas legales creadas
- [x] 3 funciones SQL disponibles  
- [x] RLS habilitado en todas las tablas
- [x] 5 subprocesadores insertados como seed data
- [x] Sin errores en la ejecución

## 🚨 Si Hay Errores
**Error común: "relation already exists"**
- Ejecutar: `DROP TABLE IF EXISTS [tabla] CASCADE;` antes de CREATE

**Error: "permission denied"**  
- Verificar que estás usando el proyecto CORRECTO
- Confirmar permisos de admin en Supabase

---

**⏱️ Tiempo estimado:** 5-10 minutos  
**🎯 Siguiente paso:** Configurar variables Netlify una vez completado