-- Agente Virtual IA - Initial Database Schema
-- This migration creates the core tables for the Agente Virtual IA application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE plan_key AS ENUM ('starter', 'pro', 'enterprise', 'custom');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'past_due', 'canceled', 'trialing');
CREATE TYPE execution_status AS ENUM ('success', 'error', 'running', 'waiting', 'canceled');

-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan plan_key DEFAULT 'starter',
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  n8n_base_url TEXT,
  n8n_api_key TEXT,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RLS policies for tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tenant" ON tenants
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "Users can update their own tenant" ON tenants
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert their own tenant" ON tenants
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Plans table
CREATE TABLE plans (
  key plan_key PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stripe_price_id TEXT,
  limits JSONB DEFAULT '{}',
  features JSONB DEFAULT '[]',
  price_monthly INTEGER DEFAULT 0, -- in cents
  price_yearly INTEGER DEFAULT 0, -- in cents
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (key, name, description, limits, features, price_monthly, price_yearly) VALUES
('starter', 'Starter', 'Perfect for small teams getting started', 
 '{"executions_per_month": 1000, "workflows": 10, "history_days": 30}',
 '["Basic workflows", "Standard support", "30-day history"]',
 0, 0),
('pro', 'Pro', 'For growing businesses with advanced needs',
 '{"executions_per_month": 10000, "workflows": 100, "history_days": 90}',
 '["Advanced workflows", "Priority support", "90-day history", "Custom integrations"]',
 2900, 29000),
('enterprise', 'Enterprise', 'For large organizations with custom requirements',
 '{"executions_per_month": -1, "workflows": -1, "history_days": 365}',
 '["Unlimited workflows", "24/7 support", "1-year history", "SSO", "Dedicated support"]',
 9900, 99000);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status subscription_status DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RLS policies for subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant subscriptions" ON subscriptions
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Usage executions table
CREATE TABLE usage_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  execution_id TEXT NOT NULL UNIQUE,
  workflow_name TEXT,
  status execution_status NOT NULL,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  duration_ms BIGINT,
  node_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for usage_executions
CREATE INDEX idx_usage_executions_tenant_date ON usage_executions(tenant_id, created_at DESC);
CREATE INDEX idx_usage_executions_workflow ON usage_executions(tenant_id, workflow_id, created_at DESC);
CREATE INDEX idx_usage_executions_status ON usage_executions(tenant_id, status, created_at DESC);

-- Create RLS policies for usage_executions
ALTER TABLE usage_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant usage" ON usage_executions
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  subcategory TEXT,
  workflow_json JSONB NOT NULL,
  icon_url TEXT,
  preview_images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  difficulty TEXT DEFAULT 'beginner', -- beginner, intermediate, advanced
  estimated_time INTEGER DEFAULT 5, -- in minutes
  price INTEGER DEFAULT 0, -- in cents, 0 for free
  install_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for templates
CREATE INDEX idx_templates_category ON templates(category, subcategory);
CREATE INDEX idx_templates_featured ON templates(is_featured, created_at DESC);
CREATE INDEX idx_templates_popular ON templates(install_count DESC, rating DESC);

-- Template installs table
CREATE TABLE template_installs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT,
  metadata JSONB DEFAULT '{}',
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, template_id, workflow_id)
);

-- Create RLS policies for template_installs
ALTER TABLE template_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant installs" ON template_installs
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for audit_logs
CREATE INDEX idx_audit_logs_tenant_date ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(tenant_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(tenant_id, resource, created_at DESC);

-- Create RLS policies for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant audit logs" ON audit_logs
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Create dashboard metrics view
CREATE OR REPLACE VIEW dashboard_metrics_24h AS
SELECT 
  tenant_id,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
  COUNT(*) FILTER (WHERE status = 'error') as failed_executions,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / COUNT(*)) * 100, 2
  ) as success_rate,
  ROUND(AVG(duration_ms)::DECIMAL / 1000, 2) as avg_duration_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) / 1000 as p95_duration_seconds,
  COUNT(DISTINCT workflow_id) as active_workflows
FROM usage_executions 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY tenant_id;

-- Insert some sample templates
INSERT INTO templates (name, description, category, workflow_json, tags, difficulty, estimated_time) VALUES
('Email Notification', 'Send email notifications when specific events occur', 'notifications', 
 '{"nodes":[{"id":"1","name":"Manual Trigger","type":"n8n-nodes-base.manualTrigger","typeVersion":1,"position":[250,300],"parameters":{}},{"id":"2","name":"Email","type":"n8n-nodes-base.emailSend","typeVersion":2,"position":[450,300],"parameters":{"message":"Hello from RP9!"}}],"connections":{"Manual Trigger":{"main":[[{"node":"Email","type":"main","index":0}]]}}}',
 ARRAY['email', 'notification', 'basic'], 'beginner', 5),
 
('HTTP API to Slack', 'Forward HTTP requests to Slack channels', 'integrations',
 '{"nodes":[{"id":"1","name":"Webhook","type":"n8n-nodes-base.webhook","typeVersion":1,"position":[250,300],"parameters":{}},{"id":"2","name":"Slack","type":"n8n-nodes-base.slack","typeVersion":2,"position":[450,300],"parameters":{"channel":"#general","text":"New webhook received"}}],"connections":{"Webhook":{"main":[[{"node":"Slack","type":"main","index":0}]]}}}',
 ARRAY['webhook', 'slack', 'api'], 'intermediate', 10),
 
('Database Backup', 'Automated daily database backup to cloud storage', 'data',
 '{"nodes":[{"id":"1","name":"Cron","type":"n8n-nodes-base.cron","typeVersion":1,"position":[250,300],"parameters":{"triggerTimes":{"hour":2,"minute":0}}},{"id":"2","name":"PostgreSQL","type":"n8n-nodes-base.postgres","typeVersion":2,"position":[450,300],"parameters":{"operation":"executeQuery","query":"BACKUP DATABASE"}}],"connections":{"Cron":{"main":[[{"node":"PostgreSQL","type":"main","index":0}]]}}}',
 ARRAY['database', 'backup', 'automation'], 'advanced', 15);

-- Update templates install count trigger
CREATE OR REPLACE FUNCTION update_template_install_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE templates 
    SET install_count = install_count + 1 
    WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE templates 
    SET install_count = GREATEST(0, install_count - 1) 
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_install_count
  AFTER INSERT OR DELETE ON template_installs
  FOR EACH ROW EXECUTE FUNCTION update_template_install_count();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER trigger_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();