-- =============================================
-- MIGRATION: 008_fase7_ai_sso_marketplace.sql
-- Descripción: Fase 7 - AI Assistant + SSO/2FA + Marketplace Monetizado
-- Fecha: 2025-01-12
-- =============================================

-- ============================================
-- 1. TABLAS PARA AI ASSISTANT
-- ============================================

-- Conversaciones con AI Assistant
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('generate', 'debug', 'optimize', 'chat')),
  messages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_ai_conversations_tenant_user (tenant_id, user_id),
  INDEX idx_ai_conversations_type (type),
  INDEX idx_ai_conversations_created_at (created_at DESC)
);

-- Workflows generados por IA
CREATE TABLE IF NOT EXISTS ai_generated_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  generated_json JSONB NOT NULL,
  validation_results JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}', -- descripción, categoría, dificultad, etc.
  installed BOOLEAN DEFAULT false,
  workflow_id TEXT, -- ID del workflow en n8n una vez instalado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_ai_workflows_tenant (tenant_id),
  INDEX idx_ai_workflows_conversation (conversation_id),
  INDEX idx_ai_workflows_installed (installed),
  INDEX idx_ai_workflows_created_at (created_at DESC)
);

-- Feedback de usuarios sobre IA
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_ai_feedback_tenant (tenant_id),
  INDEX idx_ai_feedback_rating (rating),
  INDEX idx_ai_feedback_created_at (created_at DESC)
);

-- Errores de ejecución analizados por IA
CREATE TABLE IF NOT EXISTS execution_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  error_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  main_error TEXT NOT NULL,
  error_code TEXT,
  http_status INTEGER,
  node_name TEXT,
  analysis JSONB DEFAULT '{}', -- Resultado completo del análisis de IA
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_execution_errors_tenant (tenant_id),
  INDEX idx_execution_errors_workflow (workflow_id),
  INDEX idx_execution_errors_severity (severity),
  INDEX idx_execution_errors_resolved (resolved),
  INDEX idx_execution_errors_created_at (created_at DESC),
  
  -- Constraint único por ejecución
  UNIQUE(tenant_id, execution_id)
);

-- Optimizaciones de workflows analizadas por IA
CREATE TABLE IF NOT EXISTS workflow_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  complexity_analysis JSONB DEFAULT '{}',
  optimization_analysis JSONB NOT NULL,
  suggestions_count INTEGER DEFAULT 0,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_workflow_optimizations_tenant (tenant_id),
  INDEX idx_workflow_optimizations_workflow (workflow_id),
  INDEX idx_workflow_optimizations_score (overall_score),
  INDEX idx_workflow_optimizations_applied (applied),
  INDEX idx_workflow_optimizations_created_at (created_at DESC)
);

-- ============================================
-- 2. TABLAS PARA SSO & 2FA
-- ============================================

-- Configuración SSO por tenant
CREATE TABLE IF NOT EXISTS tenant_sso_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'azure', 'okta', 'auth0', 'saml')),
  config JSONB NOT NULL, -- Configuración específica del proveedor
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_tenant_sso_config_provider (provider),
  INDEX idx_tenant_sso_config_enabled (enabled)
);

-- Configuración 2FA por usuario
CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  totp_secret TEXT, -- Secreto TOTP encriptado
  backup_codes TEXT[] DEFAULT '{}', -- Códigos de backup encriptados
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_user_2fa_enabled (enabled),
  INDEX idx_user_2fa_last_used (last_used_at DESC)
);

-- Sesiones de autenticación (para auditoría y control)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  login_method TEXT NOT NULL CHECK (login_method IN ('email', 'sso_google', 'sso_azure', 'sso_okta', 'sso_auth0', 'sso_saml')),
  requires_2fa BOOLEAN DEFAULT false,
  two_fa_verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_auth_sessions_user (user_id),
  INDEX idx_auth_sessions_tenant (tenant_id),
  INDEX idx_auth_sessions_expires_at (expires_at),
  INDEX idx_auth_sessions_last_activity (last_activity_at DESC)
);

-- ============================================
-- 3. TABLAS PARA MARKETPLACE MONETIZADO
-- ============================================

-- Perfiles de creadores/vendedores
CREATE TABLE IF NOT EXISTS creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT,
  business_description TEXT,
  tax_id TEXT,
  country_code TEXT, -- ISO 3166-1 alpha-2
  payout_method TEXT CHECK (payout_method IN ('stripe', 'bank', 'paypal')),
  payout_config JSONB DEFAULT '{}', -- Configuración específica del método de pago
  commission_rate DECIMAL(5,4) DEFAULT 0.30, -- Comisión por defecto 30%
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  total_earnings_cents INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_creator_profiles_verified (verified),
  INDEX idx_creator_profiles_country (country_code),
  INDEX idx_creator_profiles_earnings (total_earnings_cents DESC)
);

-- Ventas de templates (cada compra individual)
CREATE TABLE IF NOT EXISTS template_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  buyer_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  creator_earnings_cents INTEGER NOT NULL, -- price_cents - commission_cents
  currency_code TEXT DEFAULT 'USD',
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_template_sales_template (template_id),
  INDEX idx_template_sales_buyer (buyer_tenant_id),
  INDEX idx_template_sales_creator (creator_id),
  INDEX idx_template_sales_status (status),
  INDEX idx_template_sales_completed_at (completed_at DESC),
  INDEX idx_template_sales_created_at (created_at DESC),
  
  -- Evitar compras duplicadas
  UNIQUE(template_id, buyer_tenant_id)
);

-- Pagos a creadores (payouts agrupados por período)
CREATE TABLE IF NOT EXISTS creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_earnings_cents INTEGER NOT NULL,
  commission_deducted_cents INTEGER NOT NULL,
  net_payout_cents INTEGER NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  stripe_transfer_id TEXT,
  bank_transfer_reference TEXT,
  paypal_batch_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Índices
  INDEX idx_creator_payouts_creator (creator_id),
  INDEX idx_creator_payouts_period_start (period_start),
  INDEX idx_creator_payouts_status (status),
  INDEX idx_creator_payouts_paid_at (paid_at DESC),
  
  -- Un payout por creator por período
  UNIQUE(creator_id, period_start, period_end)
);

-- Analytics detallados por template y creator
CREATE TABLE IF NOT EXISTS template_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0, -- Descargas gratuitas
  sales INTEGER DEFAULT 0, -- Ventas premium
  revenue_cents INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4) DEFAULT 0, -- sales/views
  refunds INTEGER DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_template_analytics_template_date (template_id, date DESC),
  INDEX idx_template_analytics_creator_date (creator_id, date DESC),
  INDEX idx_template_analytics_date (date DESC),
  INDEX idx_template_analytics_revenue (revenue_cents DESC),
  
  -- Un registro por template por día
  UNIQUE(template_id, date)
);

-- Comisiones y configuración de revenue sharing
CREATE TABLE IF NOT EXISTS revenue_sharing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_category TEXT NOT NULL,
  price_tier TEXT NOT NULL, -- 'free', 'basic', 'premium', 'enterprise'
  min_price_cents INTEGER NOT NULL,
  max_price_cents INTEGER,
  platform_commission_rate DECIMAL(5,4) NOT NULL, -- % que se queda RP9
  creator_commission_rate DECIMAL(5,4) NOT NULL,   -- % que va al creator
  effective_from DATE NOT NULL,
  effective_until DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  INDEX idx_revenue_config_category (template_category),
  INDEX idx_revenue_config_tier (price_tier),
  INDEX idx_revenue_config_effective (effective_from, effective_until),
  INDEX idx_revenue_config_active (active)
);

-- ============================================
-- 4. VISTAS PARA REPORTES Y ANALYTICS
-- ============================================

-- Vista para dashboard de AI Assistant
CREATE OR REPLACE VIEW ai_assistant_dashboard AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  COUNT(DISTINCT ac.id) as total_conversations,
  COUNT(DISTINCT agw.id) as total_generated_workflows,
  COUNT(DISTINCT CASE WHEN agw.installed = true THEN agw.id END) as installed_workflows,
  AVG(af.rating) as average_rating,
  COUNT(DISTINCT ee.id) as errors_analyzed,
  COUNT(DISTINCT wo.id) as optimizations_performed,
  COUNT(DISTINCT CASE WHEN ac.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN ac.id END) as conversations_last_30d,
  COUNT(DISTINCT CASE WHEN ac.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN ac.id END) as conversations_last_7d
FROM tenants t
LEFT JOIN ai_conversations ac ON t.id = ac.tenant_id
LEFT JOIN ai_generated_workflows agw ON t.id = agw.tenant_id
LEFT JOIN ai_feedback af ON t.id = af.tenant_id
LEFT JOIN execution_errors ee ON t.id = ee.tenant_id
LEFT JOIN workflow_optimizations wo ON t.id = wo.tenant_id
GROUP BY t.id, t.name;

-- Vista para dashboard de creators
CREATE OR REPLACE VIEW creator_dashboard AS
SELECT 
  cp.id as creator_id,
  cp.user_id,
  cp.business_name,
  COUNT(DISTINCT t.id) as total_templates,
  COUNT(DISTINCT ts.id) as total_sales,
  SUM(ts.creator_earnings_cents) as total_earnings_cents,
  AVG(ta.average_rating) as average_rating,
  SUM(ta.views) as total_views,
  SUM(ta.downloads) as total_downloads,
  COUNT(DISTINCT CASE WHEN ts.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN ts.id END) as sales_last_30d,
  SUM(CASE WHEN ts.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN ts.creator_earnings_cents ELSE 0 END) as earnings_last_30d
FROM creator_profiles cp
LEFT JOIN templates t ON t.metadata->>'creator_id' = cp.id::text
LEFT JOIN template_sales ts ON ts.creator_id = cp.id
LEFT JOIN template_analytics ta ON ta.creator_id = cp.id
GROUP BY cp.id, cp.user_id, cp.business_name;

-- Vista para métricas de marketplace
CREATE OR REPLACE VIEW marketplace_metrics AS
SELECT 
  COUNT(DISTINCT cp.id) as total_creators,
  COUNT(DISTINCT t.id) as total_templates,
  COUNT(DISTINCT CASE WHEN t.price > 0 THEN t.id END) as premium_templates,
  COUNT(DISTINCT ts.id) as total_sales,
  SUM(ts.price_cents) as total_revenue_cents,
  SUM(ts.commission_cents) as total_commission_cents,
  SUM(ts.creator_earnings_cents) as total_creator_earnings_cents,
  AVG(ts.price_cents) as average_sale_price_cents,
  COUNT(DISTINCT ts.buyer_tenant_id) as unique_buyers,
  COUNT(DISTINCT CASE WHEN ts.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN ts.id END) as sales_last_30d,
  SUM(CASE WHEN ts.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN ts.price_cents ELSE 0 END) as revenue_last_30d_cents
FROM creator_profiles cp
LEFT JOIN templates t ON t.metadata->>'creator_id' = cp.id::text
LEFT JOIN template_sales ts ON ts.creator_id = cp.id;

-- ============================================
-- 5. FUNCIONES PARA CÁLCULOS AUTOMATIZADOS
-- ============================================

-- Función para calcular comisiones basadas en configuración
CREATE OR REPLACE FUNCTION calculate_commission(
  template_category TEXT,
  price_cents INTEGER,
  sale_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
  platform_commission_cents INTEGER,
  creator_earnings_cents INTEGER
) AS $$
DECLARE
  config_row revenue_sharing_config%ROWTYPE;
BEGIN
  -- Buscar configuración activa para la categoría y precio
  SELECT * INTO config_row
  FROM revenue_sharing_config
  WHERE template_category = calculate_commission.template_category
    AND price_cents >= min_price_cents
    AND (max_price_cents IS NULL OR price_cents <= max_price_cents)
    AND sale_date >= effective_from
    AND (effective_until IS NULL OR sale_date <= effective_until)
    AND active = true
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Si no hay configuración específica, usar valores por defecto
  IF NOT FOUND THEN
    config_row.platform_commission_rate := 0.30;
    config_row.creator_commission_rate := 0.70;
  END IF;
  
  RETURN QUERY SELECT 
    (price_cents * config_row.platform_commission_rate)::INTEGER as platform_commission_cents,
    (price_cents * config_row.creator_commission_rate)::INTEGER as creator_earnings_cents;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar analytics diarios
CREATE OR REPLACE FUNCTION update_template_analytics() RETURNS VOID AS $$
BEGIN
  INSERT INTO template_analytics (
    template_id,
    creator_id,
    date,
    sales,
    revenue_cents,
    refunds
  )
  SELECT 
    ts.template_id,
    ts.creator_id,
    CURRENT_DATE,
    COUNT(*) as sales,
    SUM(ts.price_cents) as revenue_cents,
    COUNT(CASE WHEN ts.status = 'refunded' THEN 1 END) as refunds
  FROM template_sales ts
  WHERE ts.completed_at >= CURRENT_DATE
    AND ts.completed_at < CURRENT_DATE + INTERVAL '1 day'
    AND ts.status IN ('completed', 'refunded')
  GROUP BY ts.template_id, ts.creator_id
  ON CONFLICT (template_id, date) DO UPDATE SET
    sales = EXCLUDED.sales,
    revenue_cents = EXCLUDED.revenue_cents,
    refunds = EXCLUDED.refunds,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. RLS (ROW LEVEL SECURITY) POLICIES
-- ============================================

-- AI Conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_conversations_tenant_policy ON ai_conversations
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- AI Generated Workflows
ALTER TABLE ai_generated_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_workflows_tenant_policy ON ai_generated_workflows
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- AI Feedback
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_feedback_tenant_policy ON ai_feedback
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- Execution Errors
ALTER TABLE execution_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY execution_errors_tenant_policy ON execution_errors
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- Workflow Optimizations
ALTER TABLE workflow_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_optimizations_tenant_policy ON workflow_optimizations
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

-- SSO Config
ALTER TABLE tenant_sso_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY sso_config_tenant_owner_policy ON tenant_sso_config
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
  ));

-- User 2FA
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_2fa_self_policy ON user_2fa
  USING (user_id = auth.uid());

-- Auth Sessions
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_sessions_self_policy ON auth_sessions
  USING (user_id = auth.uid());

-- Creator Profiles
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_profiles_self_policy ON creator_profiles
  USING (user_id = auth.uid());

-- Template Sales (buyers can see their purchases, creators can see their sales)
ALTER TABLE template_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY template_sales_buyer_policy ON template_sales
  USING (buyer_tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION
    SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY template_sales_creator_policy ON template_sales
  USING (creator_id IN (
    SELECT id FROM creator_profiles WHERE user_id = auth.uid()
  ));

-- Creator Payouts
ALTER TABLE creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_payouts_self_policy ON creator_payouts
  USING (creator_id IN (
    SELECT id FROM creator_profiles WHERE user_id = auth.uid()
  ));

-- Template Analytics
ALTER TABLE template_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY template_analytics_creator_policy ON template_analytics
  USING (creator_id IN (
    SELECT id FROM creator_profiles WHERE user_id = auth.uid()
  ));

-- ============================================
-- 7. CONFIGURACIÓN INICIAL DE REVENUE SHARING
-- ============================================

INSERT INTO revenue_sharing_config (
  template_category,
  price_tier,
  min_price_cents,
  max_price_cents,
  platform_commission_rate,
  creator_commission_rate,
  effective_from
) VALUES
  ('automation', 'free', 0, 0, 0.00, 1.00, CURRENT_DATE),
  ('automation', 'basic', 100, 5000, 0.30, 0.70, CURRENT_DATE), -- $1-$50
  ('automation', 'premium', 5001, 15000, 0.25, 0.75, CURRENT_DATE), -- $50-$150
  ('automation', 'enterprise', 15001, NULL, 0.20, 0.80, CURRENT_DATE), -- $150+
  
  ('integration', 'free', 0, 0, 0.00, 1.00, CURRENT_DATE),
  ('integration', 'basic', 100, 5000, 0.30, 0.70, CURRENT_DATE),
  ('integration', 'premium', 5001, 15000, 0.25, 0.75, CURRENT_DATE),
  ('integration', 'enterprise', 15001, NULL, 0.20, 0.80, CURRENT_DATE),
  
  ('crm', 'free', 0, 0, 0.00, 1.00, CURRENT_DATE),
  ('crm', 'basic', 100, 5000, 0.30, 0.70, CURRENT_DATE),
  ('crm', 'premium', 5001, 15000, 0.25, 0.75, CURRENT_DATE),
  ('crm', 'enterprise', 15001, NULL, 0.20, 0.80, CURRENT_DATE),
  
  ('finance', 'free', 0, 0, 0.00, 1.00, CURRENT_DATE),
  ('finance', 'basic', 100, 5000, 0.30, 0.70, CURRENT_DATE),
  ('finance', 'premium', 5001, 15000, 0.25, 0.75, CURRENT_DATE),
  ('finance', 'enterprise', 15001, NULL, 0.20, 0.80, CURRENT_DATE),
  
  ('contact-center', 'free', 0, 0, 0.00, 1.00, CURRENT_DATE),
  ('contact-center', 'basic', 100, 5000, 0.30, 0.70, CURRENT_DATE),
  ('contact-center', 'premium', 5001, 15000, 0.25, 0.75, CURRENT_DATE),
  ('contact-center', 'enterprise', 15001, NULL, 0.20, 0.80, CURRENT_DATE);

-- ============================================
-- 8. COMENTARIOS FINALES
-- ============================================

COMMENT ON TABLE ai_conversations IS 'Conversaciones del usuario con AI Assistant';
COMMENT ON TABLE ai_generated_workflows IS 'Workflows generados por IA con sus metadatos';
COMMENT ON TABLE ai_feedback IS 'Feedback de usuarios sobre respuestas del AI Assistant';
COMMENT ON TABLE execution_errors IS 'Errores de ejecución analizados por IA';
COMMENT ON TABLE workflow_optimizations IS 'Análisis de optimización de workflows por IA';

COMMENT ON TABLE tenant_sso_config IS 'Configuración SSO por tenant (Google, Azure, SAML, etc.)';
COMMENT ON TABLE user_2fa IS 'Configuración 2FA por usuario (TOTP + backup codes)';
COMMENT ON TABLE auth_sessions IS 'Sesiones de autenticación para auditoría y control';

COMMENT ON TABLE creator_profiles IS 'Perfiles de creadores/vendedores en el marketplace';
COMMENT ON TABLE template_sales IS 'Ventas individuales de templates premium';
COMMENT ON TABLE creator_payouts IS 'Pagos agrupados a creadores por período';
COMMENT ON TABLE template_analytics IS 'Analytics diarios por template y creator';
COMMENT ON TABLE revenue_sharing_config IS 'Configuración de comisiones por categoría y tier';

-- =============================================
-- FIN MIGRATION 008
-- =============================================