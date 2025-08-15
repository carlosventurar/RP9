-- Agente Virtual IA - Templates Database Schema
-- Run this in your Supabase SQL editor

-- ===================================================
-- TABLES
-- ===================================================

-- Main templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  workflow_json JSONB NOT NULL,
  icon_url TEXT,
  preview_images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_time INTEGER NOT NULL DEFAULT 5,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  install_count INTEGER NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 4.5 CHECK (rating >= 0 AND rating <= 5),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template purchases tracking
CREATE TABLE IF NOT EXISTS template_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  stripe_payment_intent_id VARCHAR(255) NOT NULL UNIQUE,
  amount_paid DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded'))
);

-- Template installations tracking
CREATE TABLE IF NOT EXISTS template_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  n8n_workflow_id VARCHAR(255) NOT NULL,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  custom_name VARCHAR(255)
);

-- ===================================================
-- INDEXES
-- ===================================================

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_price ON templates(price);
CREATE INDEX IF NOT EXISTS idx_templates_featured ON templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_rating ON templates(rating DESC);
CREATE INDEX IF NOT EXISTS idx_templates_installs ON templates(install_count DESC);
CREATE INDEX IF NOT EXISTS idx_template_purchases_user ON template_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_template_purchases_template ON template_purchases(template_id);
CREATE INDEX IF NOT EXISTS idx_template_installs_user ON template_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_template_installs_template ON template_installs(template_id);

-- ===================================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================================

-- Enable RLS on all tables
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_installs ENABLE ROW LEVEL SECURITY;

-- Templates are publicly readable
CREATE POLICY IF NOT EXISTS "Templates are publicly readable" ON templates
  FOR SELECT USING (true);

-- Only authenticated users can insert/update templates (admin functionality)
CREATE POLICY IF NOT EXISTS "Authenticated users can manage templates" ON templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Users can only see their own purchases
CREATE POLICY IF NOT EXISTS "Users can view their own purchases" ON template_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own purchases
CREATE POLICY IF NOT EXISTS "Users can insert their own purchases" ON template_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only see their own installs
CREATE POLICY IF NOT EXISTS "Users can view their own installs" ON template_installs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own installs
CREATE POLICY IF NOT EXISTS "Users can insert their own installs" ON template_installs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===================================================
-- FUNCTIONS AND TRIGGERS
-- ===================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on templates
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at 
  BEFORE UPDATE ON templates 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment install count
CREATE OR REPLACE FUNCTION increment_template_installs(template_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE templates 
  SET install_count = install_count + 1,
      updated_at = NOW()
  WHERE id = template_uuid;
END;
$$ language 'plpgsql';

-- ===================================================
-- SAMPLE DATA (Optional - remove if not needed)
-- ===================================================

-- Insert a few free templates for testing
INSERT INTO templates (name, description, category, workflow_json, tags, difficulty, estimated_time, price, is_featured) VALUES 
(
  'Email Notification System',
  'Simple email notifications for workflow events with customizable templates and recipient management',
  'Notifications',
  '{"nodes":[{"name":"Trigger","type":"n8n-nodes-base.webhook","position":[250,300]},{"name":"Send Email","type":"n8n-nodes-base.emailSend","position":[450,300]}],"connections":{"Trigger":{"main":[[{"node":"Send Email","type":"main","index":0}]]}}}',
  ARRAY['email', 'notification', 'webhook'],
  'beginner',
  10,
  0.00,
  true
),
(
  'Slack Integration Workflow',
  'Bi-directional Slack integration for posting messages, receiving commands, and managing channels',
  'Communication',
  '{"nodes":[{"name":"Slack Trigger","type":"n8n-nodes-base.slackTrigger","position":[250,300]},{"name":"Process Message","type":"n8n-nodes-base.function","position":[450,300]},{"name":"Reply to Slack","type":"n8n-nodes-base.slack","position":[650,300]}],"connections":{"Slack Trigger":{"main":[[{"node":"Process Message","type":"main","index":0}]]},"Process Message":{"main":[[{"node":"Reply to Slack","type":"main","index":0}]]}}}',
  ARRAY['slack', 'communication', 'bot'],
  'intermediate',
  15,
  0.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ===================================================
-- VERIFICATION QUERIES
-- ===================================================

-- Check if tables were created successfully
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'templates') THEN
    RAISE NOTICE '✅ Templates table created successfully';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'template_purchases') THEN
    RAISE NOTICE '✅ Template purchases table created successfully';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'template_installs') THEN
    RAISE NOTICE '✅ Template installs table created successfully';
  END IF;
END $$;

-- Show table structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'templates' 
ORDER BY ordinal_position;