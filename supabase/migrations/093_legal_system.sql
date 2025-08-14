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

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================
CREATE INDEX idx_legal_documents_type_version ON legal_documents(document_type, version);
CREATE INDEX idx_legal_documents_language ON legal_documents(language);
CREATE INDEX idx_legal_acceptances_user_tenant ON legal_acceptances(user_id, tenant_id);
CREATE INDEX idx_legal_acceptances_document ON legal_acceptances(document_type, document_version);
CREATE INDEX idx_contracts_tenant_type ON contracts(tenant_id, contract_type);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_subprocessor_subscriptions_tenant ON subprocessor_subscriptions(tenant_id);
CREATE INDEX idx_incidents_status_public ON incidents(status, public);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_maintenances_scheduled ON maintenances(scheduled_start, scheduled_end);
CREATE INDEX idx_sla_metrics_tenant_date ON sla_metrics(tenant_id, metric_date);
CREATE INDEX idx_sla_credits_tenant_period ON sla_credits(tenant_id, billing_period_start);

-- ===================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================

-- Enable RLS on all tables
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subprocessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subprocessor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Legal Documents: Public read for active documents, admin write
CREATE POLICY "Public read active legal documents" ON legal_documents
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admin manage legal documents" ON legal_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Legal Acceptances: Users can read their own, admins can read all for their tenant
CREATE POLICY "Users read own acceptances" ON legal_acceptances
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users insert own acceptances" ON legal_acceptances
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant admin read acceptances" ON legal_acceptances
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Contracts: Tenant-scoped access
CREATE POLICY "Tenant contracts access" ON contracts
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Subprocessors: Public read (transparency)
CREATE POLICY "Public read subprocessors" ON subprocessors
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admin manage subprocessors" ON subprocessors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Subprocessor Subscriptions: Tenant-scoped
CREATE POLICY "Tenant subprocessor subscriptions" ON subprocessor_subscriptions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Incidents: Public read for public incidents, admin write
CREATE POLICY "Public read incidents" ON incidents
  FOR SELECT USING (public = true);

CREATE POLICY "Admin manage incidents" ON incidents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Maintenances: Same as incidents
CREATE POLICY "Public read maintenances" ON maintenances
  FOR SELECT USING (public = true);

CREATE POLICY "Admin manage maintenances" ON maintenances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- SLA Metrics: Tenant-scoped
CREATE POLICY "Tenant sla metrics" ON sla_metrics
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- SLA Credits: Tenant-scoped
CREATE POLICY "Tenant sla credits" ON sla_credits
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Retention Policies: Tenant-scoped
CREATE POLICY "Tenant retention policies" ON retention_policies
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ===================================
-- VIEWS FOR REPORTING
-- ===================================

-- Materialized view for SLA reporting
CREATE MATERIALIZED VIEW sla_monthly_summary AS
SELECT 
  tenant_id,
  DATE_TRUNC('month', metric_date) as month,
  AVG(uptime_percentage) as avg_uptime,
  SUM(total_downtime_minutes) as total_downtime,
  SUM(incident_count) as total_incidents,
  COUNT(*) as days_measured
FROM sla_metrics
GROUP BY tenant_id, DATE_TRUNC('month', metric_date);

-- Create index on materialized view
CREATE INDEX idx_sla_monthly_summary_tenant_month ON sla_monthly_summary(tenant_id, month);

-- View for active legal documents by language
CREATE VIEW active_legal_documents AS
SELECT 
  id,
  document_type,
  version,
  language,
  title,
  content,
  template_variables,
  requires_signature,
  jurisdiction,
  effective_date
FROM legal_documents
WHERE status = 'active'
ORDER BY document_type, language, effective_date DESC;

-- ===================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ===================================

-- Function to calculate SLA credits based on uptime
CREATE OR REPLACE FUNCTION calculate_sla_credit(
  p_uptime_percentage DECIMAL,
  p_target_sla DECIMAL DEFAULT 99.9
) RETURNS DECIMAL AS $$
BEGIN
  -- SLA Credit tiers as per specification
  IF p_uptime_percentage >= p_target_sla THEN
    RETURN 0;
  ELSIF p_uptime_percentage >= 99.0 THEN
    RETURN 5.0; -- 5% credit
  ELSIF p_uptime_percentage >= 98.0 THEN
    RETURN 10.0; -- 10% credit
  ELSE
    RETURN 20.0; -- 20% credit
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get latest document version by type and language
CREATE OR REPLACE FUNCTION get_latest_legal_document(
  p_document_type VARCHAR,
  p_language VARCHAR DEFAULT 'es'
) RETURNS legal_documents AS $$
DECLARE
  result legal_documents;
BEGIN
  SELECT * INTO result
  FROM legal_documents
  WHERE document_type = p_document_type
    AND language = p_language
    AND status = 'active'
  ORDER BY effective_date DESC
  LIMIT 1;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user has accepted latest ToS
CREATE OR REPLACE FUNCTION user_has_accepted_latest_tos(
  p_user_id UUID,
  p_tenant_id UUID,
  p_language VARCHAR DEFAULT 'es'
) RETURNS BOOLEAN AS $$
DECLARE
  latest_version VARCHAR;
  user_accepted_version VARCHAR;
BEGIN
  -- Get latest ToS version
  SELECT version INTO latest_version
  FROM legal_documents
  WHERE document_type = 'tos'
    AND language = p_language
    AND status = 'active'
  ORDER BY effective_date DESC
  LIMIT 1;
  
  -- Get user's accepted version
  SELECT document_version INTO user_accepted_version
  FROM legal_acceptances
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND document_type = 'tos'
    AND language = p_language
  ORDER BY accepted_at DESC
  LIMIT 1;
  
  RETURN latest_version = user_accepted_version;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===================================
-- SEED DATA
-- ===================================

-- Insert default retention policies by country and plan
INSERT INTO retention_policies (tenant_id, country_code, plan_tier, logs_retention_days, execution_history_days, financial_evidence_years)
SELECT 
  (SELECT id FROM tenants LIMIT 1), -- Default tenant for seeding
  country,
  plan,
  CASE plan
    WHEN 'starter' THEN 7
    WHEN 'pro' THEN 30
    WHEN 'enterprise' THEN 90
  END as logs_days,
  CASE plan
    WHEN 'starter' THEN 30
    WHEN 'pro' THEN 90
    WHEN 'enterprise' THEN 365
  END as execution_days,
  CASE country
    WHEN 'MX' THEN 10 -- SAT requirements
    WHEN 'CO' THEN 5  -- DIAN requirements
    WHEN 'CL' THEN 6  -- SII requirements
    WHEN 'PE' THEN 4  -- SUNAT requirements
    WHEN 'AR' THEN 10 -- AFIP requirements
    WHEN 'DO' THEN 5  -- DGII requirements
    ELSE 7 -- Default for other countries
  END as financial_years
FROM 
  (VALUES ('MX'), ('CO'), ('CL'), ('PE'), ('AR'), ('DO'), ('US')) AS countries(country)
CROSS JOIN
  (VALUES ('starter'), ('pro'), ('enterprise')) AS plans(plan)
WHERE EXISTS (SELECT 1 FROM tenants LIMIT 1); -- Only if tenants exist

-- Insert default subprocessors
INSERT INTO subprocessors (name, description, purpose, data_categories, location, certification, website_url, privacy_policy_url) VALUES
('Supabase', 'Database and authentication provider', 'Database hosting, user authentication, real-time features', ARRAY['user_data', 'workflow_data', 'billing_data'], 'United States', ARRAY['SOC2 Type II'], 'https://supabase.com', 'https://supabase.com/privacy'),
('Stripe', 'Payment processing service', 'Payment processing, billing management, fraud detection', ARRAY['payment_data', 'billing_data'], 'United States', ARRAY['PCI DSS Level 1'], 'https://stripe.com', 'https://stripe.com/privacy'),
('Netlify', 'Application hosting and CDN', 'Web application hosting, static asset delivery, serverless functions', ARRAY['application_logs', 'performance_data'], 'United States', ARRAY['SOC2 Type II'], 'https://netlify.com', 'https://netlify.com/privacy'),
('Railway', 'n8n workflow orchestration hosting', 'Workflow execution, data transformation, integration management', ARRAY['workflow_data', 'integration_data'], 'United States', ARRAY['SOC2 Type I'], 'https://railway.app', 'https://railway.app/privacy'),
('Resend', 'Email delivery service', 'Transactional emails, notifications, marketing communications', ARRAY['email_data', 'communication_logs'], 'United States', ARRAY['SOC2 Type II'], 'https://resend.com', 'https://resend.com/privacy');

-- Insert base legal document templates (ToS and Privacy in both languages)
INSERT INTO legal_documents (document_type, version, language, title, content, requires_signature, effective_date, status) VALUES
('tos', '2025-01', 'es', 'Términos de Servicio - RP9 Portal', 'Placeholder content for Spanish ToS', false, NOW(), 'draft'),
('tos', '2025-01', 'en', 'Terms of Service - RP9 Portal', 'Placeholder content for English ToS', false, NOW(), 'draft'),
('privacy', '2025-01', 'es', 'Política de Privacidad - RP9 Portal', 'Placeholder content for Spanish Privacy Policy', false, NOW(), 'draft'),
('privacy', '2025-01', 'en', 'Privacy Policy - RP9 Portal', 'Placeholder content for English Privacy Policy', false, NOW(), 'draft');

-- Refresh materialized view
REFRESH MATERIALIZED VIEW sla_monthly_summary;

-- ===================================
-- TRIGGERS FOR AUDIT TRAIL
-- ===================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
CREATE TRIGGER update_legal_documents_updated_at
  BEFORE UPDATE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subprocessors_updated_at
  BEFORE UPDATE ON subprocessors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenances_updated_at
  BEFORE UPDATE ON maintenances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment for migration tracking
COMMENT ON TABLE legal_documents IS 'Fase 16: Legal document templates and versions';
COMMENT ON TABLE legal_acceptances IS 'Fase 16: User acceptances of legal documents';
COMMENT ON TABLE contracts IS 'Fase 16: MSA/DPA/SLA contracts per tenant';
COMMENT ON TABLE subprocessors IS 'Fase 16: Third-party data processors for transparency';
COMMENT ON TABLE incidents IS 'Fase 16: System incidents for status page and SLA tracking';
COMMENT ON TABLE sla_metrics IS 'Fase 16: Daily SLA metrics for credit calculation';
COMMENT ON TABLE sla_credits IS 'Fase 16: Monthly SLA credits based on uptime performance';

-- End of migration