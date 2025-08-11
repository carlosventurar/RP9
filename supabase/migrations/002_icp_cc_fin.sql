-- RP9 Portal - Fase 2: ICP Contact Center & Finance Schema
-- This migration adds tables for Contact Center events, Finance evidence, and reconciliation

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contact Center: eventos de llamadas y interacciones
CREATE TABLE IF NOT EXISTS events_cc (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- call.ended, call.transferred, etc.
  provider TEXT NOT NULL,       -- 3cx, genesys, generic
  payload JSONB NOT NULL,       -- evento completo normalizado
  occurred_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Center: tickets generados y seguimiento CSAT
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_cc_id BIGINT REFERENCES events_cc(id) ON DELETE SET NULL,
  crm TEXT NOT NULL,            -- hubspot, zendesk, freshdesk
  crm_ticket_id TEXT,           -- ID del ticket en el CRM externo
  contact_id TEXT,              -- ID del contacto en CRM
  phone TEXT,                   -- teléfono del cliente
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  status TEXT DEFAULT 'open',   -- open, pending, resolved, closed
  subject TEXT,
  description TEXT,
  csat_score INTEGER CHECK (csat_score BETWEEN 1 AND 5), -- 1-5 rating
  csat_comment TEXT,
  csat_sent_at TIMESTAMPTZ,
  csat_responded_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}',      -- metadata adicional del CRM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidencia auditable: documentos PDF/XML con hash verification
CREATE TABLE IF NOT EXISTS evidence_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  country TEXT,                 -- MX, CO, etc. para compliance regional
  workflow_id TEXT,             -- n8n workflow que procesó el documento
  execution_id TEXT,            -- n8n execution específica
  file_name TEXT NOT NULL,      -- nombre original del archivo
  file_type TEXT NOT NULL,      -- pdf, xml, jpg, etc.
  path TEXT NOT NULL,           -- ruta en Supabase Storage
  sha256 TEXT NOT NULL,         -- hash SHA-256 para verificación
  size_bytes BIGINT NOT NULL,
  validation_status TEXT DEFAULT 'pending', -- pending, valid, invalid, error
  validation_details JSONB DEFAULT '{}',    -- detalles de validación CFDI/DIAN
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance: reglas de conciliación bancaria configurables
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  matcher JSONB NOT NULL,       -- reglas de matching: {contains:"Stripe", amount_delta:2}
  target_account TEXT,          -- cuenta contable destino
  priority INTEGER DEFAULT 100, -- orden de aplicación de reglas
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance: resultados de conciliación bancaria
CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES reconciliation_rules(id) ON DELETE SET NULL,
  bank_tx JSONB NOT NULL,        -- transacción bancaria original
  accounting_tx JSONB,           -- asiento contable generado
  status TEXT NOT NULL,          -- matched, exception, manual_review
  confidence_score DECIMAL(3,2), -- 0.00-1.00 confianza del match
  matched_amount DECIMAL(15,2),
  variance_amount DECIMAL(15,2),
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance: configuración de integraciones contables
CREATE TABLE IF NOT EXISTS accounting_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,       -- quickbooks, siigo, contpaq, etc.
  config JSONB NOT NULL,        -- configuración específica del provider
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- Contact Center: configuración de integraciones CRM
CREATE TABLE IF NOT EXISTS crm_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,       -- hubspot, zendesk, freshdesk
  config JSONB NOT NULL,        -- tokens, domains, etc.
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_events_cc_tenant_time ON events_cc (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_cc_type ON events_cc (tenant_id, type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON tickets (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_csat ON tickets (tenant_id, csat_score) WHERE csat_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_tenant_time ON evidence_files (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_workflow ON evidence_files (tenant_id, workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence_files (sha256);
CREATE INDEX IF NOT EXISTS idx_recon_matches_tenant_time ON reconciliation_matches (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recon_matches_status ON reconciliation_matches (tenant_id, status, created_at DESC);

-- RLS Policies para multi-tenancy
ALTER TABLE events_cc ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their tenant's data
CREATE POLICY "Users can view their tenant's CC events" ON events_cc
  FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can view their tenant's tickets" ON tickets
  FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can view their tenant's evidence" ON evidence_files
  FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their tenant's reconciliation rules" ON reconciliation_rules
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can view their tenant's reconciliation matches" ON reconciliation_matches
  FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their tenant's accounting integrations" ON accounting_integrations
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

CREATE POLICY "Users can manage their tenant's CRM integrations" ON crm_integrations
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid()));

-- Service role policies for Functions
CREATE POLICY "Service role can manage events_cc" ON events_cc
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage tickets" ON tickets
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage evidence_files" ON evidence_files
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage reconciliation_matches" ON reconciliation_matches
  FOR ALL TO service_role USING (true);

-- Views para métricas y KPIs
CREATE OR REPLACE VIEW cc_kpis_7d AS
SELECT 
  tenant_id,
  COUNT(*) FILTER (WHERE type = 'call.ended') as total_calls,
  AVG(EXTRACT(EPOCH FROM (
    (payload->>'ended_at')::timestamptz - (payload->>'started_at')::timestamptz
  ))) as aht_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (
      (payload->>'ended_at')::timestamptz - (payload->>'started_at')::timestamptz
    ))
  ) as p95_duration_seconds,
  AVG(t.csat_score) as avg_csat,
  COUNT(*) FILTER (WHERE payload->>'status' = 'error') as error_count,
  (COUNT(*) FILTER (WHERE payload->>'status' = 'error')::DECIMAL / COUNT(*)) * 100 as error_rate_percent
FROM events_cc e
LEFT JOIN tickets t ON t.event_cc_id = e.id
WHERE e.occurred_at >= NOW() - INTERVAL '7 days'
  AND e.type = 'call.ended'
GROUP BY tenant_id;

CREATE OR REPLACE VIEW finance_kpis_7d AS
SELECT 
  tenant_id,
  COUNT(*) as total_documents,
  COUNT(*) FILTER (WHERE validation_status = 'valid') as valid_documents,
  (COUNT(*) FILTER (WHERE validation_status = 'valid')::DECIMAL / COUNT(*)) * 100 as validation_rate_percent,
  COUNT(DISTINCT workflow_id) as active_workflows,
  AVG(size_bytes) as avg_file_size_bytes,
  COUNT(*) FILTER (WHERE validation_status = 'error') as error_count
FROM evidence_files
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY tenant_id;

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_events_cc_updated_at
  BEFORE UPDATE ON events_cc
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_evidence_files_updated_at
  BEFORE UPDATE ON evidence_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_reconciliation_rules_updated_at
  BEFORE UPDATE ON reconciliation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_reconciliation_matches_updated_at
  BEFORE UPDATE ON reconciliation_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();