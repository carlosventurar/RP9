-- Template Collections & Bundles Schema
-- Sprint 3.3: Sistema de colecciones y bundles de templates

-- Template Collections table
CREATE TABLE IF NOT EXISTS template_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL,
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  bundle_price DECIMAL(10,2), -- NULL for free collections, price for paid bundles
  discount_percentage DECIMAL(5,2) DEFAULT 0, -- Bundle discount vs individual prices
  image_url TEXT,
  tags TEXT[], -- Array of tags for categorization
  template_count INTEGER DEFAULT 0,
  total_installs INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT valid_rating CHECK (average_rating >= 0 AND average_rating <= 5)
);

-- Collection Templates junction table (many-to-many)
CREATE TABLE IF NOT EXISTS collection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0, -- Order within collection
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, template_id)
);

-- Collection Reviews (separate from template reviews)
CREATE TABLE IF NOT EXISTS collection_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, user_id) -- One review per user per collection
);

-- Collection Review Helpfulness voting
CREATE TABLE IF NOT EXISTS collection_review_helpfulness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES collection_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id) -- One vote per user per review
);

-- Collection Installs/Purchases tracking
CREATE TABLE IF NOT EXISTS collection_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  purchase_price DECIMAL(10,2), -- NULL for free installs, price paid for bundles
  stripe_payment_intent_id VARCHAR(255), -- For paid bundles
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, user_id) -- Prevent duplicate installs
);

-- Collection Favorites
CREATE TABLE IF NOT EXISTS collection_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, user_id) -- One favorite per user per collection
);

-- Row Level Security (RLS) Policies
ALTER TABLE template_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_review_helpfulness ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_favorites ENABLE ROW LEVEL SECURITY;

-- Public read access to public collections
CREATE POLICY "Public collections are viewable by everyone" ON template_collections
  FOR SELECT USING (is_public = true);

-- Users can view their own private collections
CREATE POLICY "Users can view own collections" ON template_collections
  FOR SELECT USING (creator_id = auth.uid());

-- Users can create their own collections
CREATE POLICY "Users can insert own collections" ON template_collections
  FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Users can update their own collections
CREATE POLICY "Users can update own collections" ON template_collections
  FOR UPDATE USING (creator_id = auth.uid());

-- Users can delete their own collections
CREATE POLICY "Users can delete own collections" ON template_collections
  FOR DELETE USING (creator_id = auth.uid());

-- Collection templates policies
CREATE POLICY "Collection templates are viewable by everyone" ON collection_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM template_collections 
      WHERE id = collection_templates.collection_id 
      AND (is_public = true OR creator_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage templates in own collections" ON collection_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM template_collections 
      WHERE id = collection_templates.collection_id 
      AND creator_id = auth.uid()
    )
  );

-- Collection reviews policies
CREATE POLICY "Collection reviews are viewable by everyone" ON collection_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own collection reviews" ON collection_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own collection reviews" ON collection_reviews
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own collection reviews" ON collection_reviews
  FOR DELETE USING (user_id = auth.uid());

-- Collection review helpfulness policies
CREATE POLICY "Collection review helpfulness viewable by everyone" ON collection_review_helpfulness
  FOR SELECT USING (true);

CREATE POLICY "Users can vote on collection review helpfulness" ON collection_review_helpfulness
  FOR ALL USING (user_id = auth.uid());

-- Collection installs policies
CREATE POLICY "Users can view own collection installs" ON collection_installs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own collection installs" ON collection_installs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Collection favorites policies
CREATE POLICY "Users can view own collection favorites" ON collection_favorites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own collection favorites" ON collection_favorites
  FOR ALL USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_collections_creator ON template_collections(creator_id);
CREATE INDEX IF NOT EXISTS idx_template_collections_public ON template_collections(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_template_collections_featured ON template_collections(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_template_collections_tags ON template_collections USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_collection_templates_collection ON collection_templates(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_templates_template ON collection_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_collection_reviews_collection ON collection_reviews(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_installs_user ON collection_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_favorites_user ON collection_favorites(user_id);

-- Triggers for automatic counters and ratings
CREATE OR REPLACE FUNCTION update_collection_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update template count
  UPDATE template_collections SET 
    template_count = (
      SELECT COUNT(*) FROM collection_templates 
      WHERE collection_id = COALESCE(NEW.collection_id, OLD.collection_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.collection_id, OLD.collection_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_collection_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE template_collections SET 
    average_rating = (
      SELECT COALESCE(AVG(rating::decimal), 0) FROM collection_reviews 
      WHERE collection_id = COALESCE(NEW.collection_id, OLD.collection_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.collection_id, OLD.collection_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_collection_installs()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE template_collections SET 
    total_installs = (
      SELECT COUNT(*) FROM collection_installs 
      WHERE collection_id = NEW.collection_id
    ),
    updated_at = NOW()
  WHERE id = NEW.collection_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_collection_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE collection_reviews SET 
    helpful_count = (
      SELECT COUNT(*) FROM collection_review_helpfulness 
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id) AND is_helpful = true
    )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_collection_stats
  AFTER INSERT OR DELETE ON collection_templates
  FOR EACH ROW EXECUTE FUNCTION update_collection_stats();

CREATE TRIGGER trigger_update_collection_rating
  AFTER INSERT OR UPDATE OR DELETE ON collection_reviews
  FOR EACH ROW EXECUTE FUNCTION update_collection_rating();

CREATE TRIGGER trigger_update_collection_installs
  AFTER INSERT ON collection_installs
  FOR EACH ROW EXECUTE FUNCTION update_collection_installs();

CREATE TRIGGER trigger_update_collection_review_helpful_count
  AFTER INSERT OR UPDATE OR DELETE ON collection_review_helpfulness
  FOR EACH ROW EXECUTE FUNCTION update_collection_review_helpful_count();

-- Insert sample collections data
INSERT INTO template_collections (name, description, creator_id, is_public, is_featured, bundle_price, discount_percentage, image_url, tags) VALUES 
(
  'E-commerce Starter Pack',
  'Complete collection of templates to launch your online store quickly. Includes product pages, checkout flows, and inventory management.',
  'system-user-1',
  true,
  true,
  79.99,
  25.0,
  '/images/collections/ecommerce-starter.jpg',
  ARRAY['e-commerce', 'starter', 'bundle', 'sales']
),
(
  'Marketing Automation Suite',
  'Comprehensive marketing tools including email campaigns, lead scoring, and customer segmentation templates.',
  'system-user-1',
  true,
  true,
  129.99,
  30.0,
  '/images/collections/marketing-suite.jpg',
  ARRAY['marketing', 'automation', 'campaigns', 'leads']
),
(
  'CRM Power Bundle',
  'Everything you need for customer relationship management. Contact management, sales pipeline, and reporting.',
  'system-user-1',
  true,
  false,
  99.99,
  20.0,
  '/images/collections/crm-bundle.jpg',
  ARRAY['crm', 'sales', 'customers', 'pipeline']
),
(
  'Free Getting Started Collection',
  'Essential templates to get started with the platform. Perfect for beginners and small projects.',
  'system-user-1',
  true,
  true,
  NULL,
  0,
  '/images/collections/getting-started.jpg',
  ARRAY['free', 'beginner', 'essential', 'starter']
),
(
  'Advanced Developer Tools',
  'Professional-grade templates for experienced developers. Includes advanced workflows and integrations.',
  'system-user-1',
  true,
  false,
  199.99,
  35.0,
  '/images/collections/developer-tools.jpg',
  ARRAY['advanced', 'developer', 'professional', 'integrations']
);

-- Add templates to collections (sample data)
-- E-commerce Starter Pack
INSERT INTO collection_templates (collection_id, template_id, order_index) VALUES 
((SELECT id FROM template_collections WHERE name = 'E-commerce Starter Pack'), 'template-1', 1),
((SELECT id FROM template_collections WHERE name = 'E-commerce Starter Pack'), 'template-2', 2);

-- Marketing Automation Suite  
INSERT INTO collection_templates (collection_id, template_id, order_index) VALUES 
((SELECT id FROM template_collections WHERE name = 'Marketing Automation Suite'), 'template-3', 1),
((SELECT id FROM template_collections WHERE name = 'Marketing Automation Suite'), 'template-4', 2);

-- Free Getting Started Collection
INSERT INTO collection_templates (collection_id, template_id, order_index) VALUES 
((SELECT id FROM template_collections WHERE name = 'Free Getting Started Collection'), 'template-5', 1);

-- Sample collection reviews
INSERT INTO collection_reviews (collection_id, user_id, rating, comment) VALUES 
((SELECT id FROM template_collections WHERE name = 'E-commerce Starter Pack'), 'user-1', 5, 'Amazing collection! Saved me weeks of development time. The templates are well-designed and easy to customize.'),
((SELECT id FROM template_collections WHERE name = 'E-commerce Starter Pack'), 'user-2', 4, 'Great value for money. The bundle discount makes it very affordable compared to buying individually.'),
((SELECT id FROM template_collections WHERE name = 'Marketing Automation Suite'), 'user-3', 5, 'Professional quality templates. The email campaign template alone is worth the price.'),
((SELECT id FROM template_collections WHERE name = 'Free Getting Started Collection'), 'user-4', 5, 'Perfect for beginners! Clear documentation and easy to follow examples.');

COMMENT ON TABLE template_collections IS 'Collections and bundles of templates that can be installed together';
COMMENT ON TABLE collection_templates IS 'Many-to-many relationship between collections and templates';
COMMENT ON TABLE collection_reviews IS 'User reviews and ratings for template collections';
COMMENT ON TABLE collection_installs IS 'Tracking of collection installations and purchases';
COMMENT ON TABLE collection_favorites IS 'User favorites for collections';