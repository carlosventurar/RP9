-- GTM System Migration - Leads, CRM Events, Webinars, ROI Tracking
-- This migration creates the foundation for the GTM (Go-to-Market) system

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  industry VARCHAR(100),
  company_size VARCHAR(50),
  country VARCHAR(10) DEFAULT 'MX',
  source VARCHAR(50), -- 'roi-calculator', 'webinar', 'partner', 'organic', etc.
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(100),
  utm_term VARCHAR(100),
  
  -- Lead scoring
  score INTEGER DEFAULT 0,
  grade VARCHAR(10) DEFAULT 'C', -- A, B, C, D grades
  
  -- CRM sync
  hubspot_contact_id VARCHAR(100),
  hubspot_company_id VARCHAR(100),
  freshsales_contact_id VARCHAR(100),
  freshsales_account_id VARCHAR(100),
  crm_last_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'new', -- new, qualified, demo, pilot, customer, lost
  stage VARCHAR(50) DEFAULT 'lead', -- lead, mql, sql, opportunity, customer
  
  -- Additional data
  notes TEXT,
  roi_calculation JSONB,
  demo_requested BOOLEAN DEFAULT FALSE,
  demo_scheduled_at TIMESTAMP WITH TIME ZONE,
  pilot_requested BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_score CHECK (score >= 0 AND score <= 100),
  CONSTRAINT valid_grade CHECK (grade IN ('A', 'B', 'C', 'D'))
);

-- Create indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_hubspot_contact ON leads(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_freshsales_contact ON leads(freshsales_contact_id);

-- Create CRM events table
CREATE TABLE IF NOT EXISTS crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL, -- 'contact_created', 'deal_created', 'stage_changed', 'demo_scheduled', etc.
  event_source VARCHAR(50) NOT NULL, -- 'hubspot', 'freshsales', 'manual', 'automation'
  
  -- CRM identifiers
  crm_contact_id VARCHAR(100),
  crm_company_id VARCHAR(100),
  crm_deal_id VARCHAR(100),
  
  -- Event data
  old_value JSONB,
  new_value JSONB,
  properties JSONB,
  
  -- Metadata
  external_event_id VARCHAR(255), -- CRM webhook event ID
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for CRM events
CREATE INDEX IF NOT EXISTS idx_crm_events_lead_id ON crm_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_type ON crm_events(event_type);
CREATE INDEX IF NOT EXISTS idx_crm_events_source ON crm_events(event_source);
CREATE INDEX IF NOT EXISTS idx_crm_events_created_at ON crm_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_events_external_id ON crm_events(external_event_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_processed ON crm_events(processed);

-- Create webinar registrations table
CREATE TABLE IF NOT EXISTS webinar_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Registration details
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  phone VARCHAR(50),
  
  -- Webinar details
  webinar_id VARCHAR(100) NOT NULL,
  webinar_title VARCHAR(255) NOT NULL,
  webinar_date TIMESTAMP WITH TIME ZONE,
  webinar_type VARCHAR(50) DEFAULT 'live', -- live, on-demand, office-hours
  
  -- Status
  status VARCHAR(50) DEFAULT 'registered', -- registered, attended, no-show, cancelled
  attended BOOLEAN DEFAULT FALSE,
  attendance_duration INTEGER, -- minutes attended
  
  -- UTM tracking
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Follow-up
  follow_up_sent BOOLEAN DEFAULT FALSE,
  follow_up_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for webinar registrations
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_lead_id ON webinar_registrations(lead_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_email ON webinar_registrations(email);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_webinar_id ON webinar_registrations(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_status ON webinar_registrations(status);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_date ON webinar_registrations(webinar_date);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_created_at ON webinar_registrations(created_at DESC);

-- Create ROI calculation events table
CREATE TABLE IF NOT EXISTS roi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- User details (may not be a lead yet)
  email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  
  -- Calculation inputs
  team_size INTEGER,
  avg_hourly_rate DECIMAL(10,2),
  manual_tasks_per_month INTEGER,
  time_per_task DECIMAL(5,2),
  automation_percentage INTEGER,
  current_tools_cost DECIMAL(10,2),
  industry VARCHAR(100),
  
  -- Calculation results
  monthly_savings DECIMAL(12,2),
  annual_savings DECIMAL(12,2),
  roi_percentage DECIMAL(8,2),
  payback_months INTEGER,
  hours_freed INTEGER,
  
  -- Tracking
  session_id VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Actions taken
  cta_clicked BOOLEAN DEFAULT FALSE,
  cta_type VARCHAR(50), -- 'demo-request', 'pilot-request', 'contact-sales'
  lead_generated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ROI events
CREATE INDEX IF NOT EXISTS idx_roi_events_lead_id ON roi_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_roi_events_email ON roi_events(email);
CREATE INDEX IF NOT EXISTS idx_roi_events_session_id ON roi_events(session_id);
CREATE INDEX IF NOT EXISTS idx_roi_events_created_at ON roi_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_events_cta_clicked ON roi_events(cta_clicked);
CREATE INDEX IF NOT EXISTS idx_roi_events_lead_generated ON roi_events(lead_generated);
CREATE INDEX IF NOT EXISTS idx_roi_events_industry ON roi_events(industry);

-- Create partner applications table
CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact details
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  
  -- Partner details
  partner_type VARCHAR(50) NOT NULL, -- consultant, agency, freelancer, reseller
  experience_level VARCHAR(50), -- beginner, intermediate, expert
  specialties TEXT[], -- Array of specialties
  target_industries TEXT[], -- Array of industries they serve
  monthly_capacity INTEGER, -- Hours per month available
  
  -- Business info
  current_clients INTEGER,
  annual_revenue DECIMAL(12,2),
  team_size INTEGER,
  
  -- Application
  motivation TEXT,
  relevant_experience TEXT,
  referral_source VARCHAR(100),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, on-hold
  tier VARCHAR(10), -- silver, gold (after approval)
  notes TEXT,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- CRM sync
  hubspot_contact_id VARCHAR(100),
  crm_last_sync_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for partner applications
CREATE INDEX IF NOT EXISTS idx_partner_applications_email ON partner_applications(email);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_type ON partner_applications(partner_type);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at ON partner_applications(created_at DESC);

-- Create lead scoring rules table (for automated scoring)
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition_type VARCHAR(50) NOT NULL, -- 'field_match', 'calculation', 'external_data'
  
  -- Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL,
  
  -- Scoring
  points INTEGER NOT NULL,
  grade_modifier VARCHAR(10), -- Can modify grade directly
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- Higher priority rules run first
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for lead scoring rules
CREATE INDEX IF NOT EXISTS idx_lead_scoring_rules_active ON lead_scoring_rules(active);
CREATE INDEX IF NOT EXISTS idx_lead_scoring_rules_priority ON lead_scoring_rules(priority DESC);

-- Create triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all relevant tables
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webinar_registrations_updated_at BEFORE UPDATE ON webinar_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partner_applications_updated_at BEFORE UPDATE ON partner_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_scoring_rules_updated_at BEFORE UPDATE ON lead_scoring_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  total_score INTEGER := 0;
  rule RECORD;
  lead_data RECORD;
BEGIN
  -- Get lead data
  SELECT * INTO lead_data FROM leads WHERE id = lead_uuid;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Apply scoring rules
  FOR rule IN 
    SELECT * FROM lead_scoring_rules 
    WHERE active = TRUE 
    ORDER BY priority DESC 
  LOOP
    -- Simple scoring logic (can be extended)
    CASE rule.condition_type
      WHEN 'field_match' THEN
        -- Example: If company_size = 'enterprise' add 20 points
        IF rule.conditions->>'field' = 'company_size' AND 
           lead_data.company_size = rule.conditions->>'value' THEN
          total_score := total_score + rule.points;
        END IF;
      WHEN 'source_bonus' THEN
        -- Example: If source = 'roi-calculator' add 15 points
        IF rule.conditions->>'field' = 'source' AND 
           lead_data.source = rule.conditions->>'value' THEN
          total_score := total_score + rule.points;
        END IF;
    END CASE;
  END LOOP;
  
  -- Ensure score is within bounds
  total_score := LEAST(100, GREATEST(0, total_score));
  
  RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Insert default lead scoring rules
INSERT INTO lead_scoring_rules (name, description, condition_type, conditions, points) VALUES
('Enterprise Company Size', 'Companies with 200+ employees get higher score', 'field_match', '{"field": "company_size", "value": "200+"}', 25),
('Large Company Size', 'Companies with 50-199 employees get medium score', 'field_match', '{"field": "company_size", "value": "50-199"}', 15),
('ROI Calculator Source', 'Leads from ROI calculator show high intent', 'source_bonus', '{"field": "source", "value": "roi-calculator"}', 20),
('Demo Requested', 'Leads who request demo show high intent', 'field_match', '{"field": "demo_requested", "value": "true"}', 30),
('Pilot Requested', 'Leads who request pilot show very high intent', 'field_match', '{"field": "pilot_requested", "value": "true"}', 40),
('Operations Title', 'Head of Operations is ideal buyer persona', 'field_match', '{"field": "job_title", "value": "operations"}', 20),
('Finance Title', 'CFO/Finance roles are key decision makers', 'field_match', '{"field": "job_title", "value": "finance"}', 18),
('Technology Industries', 'Tech companies adopt automation faster', 'field_match', '{"field": "industry", "value": "technology"}', 12),
('Ecommerce Industries', 'Ecommerce has many automation use cases', 'field_match', '{"field": "industry", "value": "ecommerce"}', 15);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scoring_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow service role and authenticated users to manage data)
CREATE POLICY "Allow service role full access to leads" ON leads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to crm_events" ON crm_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to webinar_registrations" ON webinar_registrations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to roi_events" ON roi_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to partner_applications" ON partner_applications
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to lead_scoring_rules" ON lead_scoring_rules
  FOR ALL USING (auth.role() = 'service_role');