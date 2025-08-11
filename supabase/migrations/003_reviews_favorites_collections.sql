-- Fase 3 Sprint 1: Reviews, Favorites, and Collections System
-- Migration 003 - Reviews, Favorites, and Collections

-- Template Reviews Table
CREATE TABLE IF NOT EXISTS template_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template Favorites Table
CREATE TABLE IF NOT EXISTS template_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, user_id)
);

-- Template Collections Table (for bundles)
CREATE TABLE IF NOT EXISTS template_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_ids UUID[] DEFAULT '{}',
  bundle_price DECIMAL(10,2),
  discount_percent INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  category VARCHAR(100),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review Helpful Votes Table
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES template_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_template_reviews_template_id ON template_reviews(template_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_user_id ON template_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_rating ON template_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_template_favorites_template_id ON template_favorites(template_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_user_id ON template_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_template_collections_category ON template_collections(category);

-- Add average_rating column to templates table (calculated field)
DO $$ BEGIN
  ALTER TABLE templates ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0;
  ALTER TABLE templates ADD COLUMN reviews_count INTEGER DEFAULT 0;
  ALTER TABLE templates ADD COLUMN favorites_count INTEGER DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Function to update template ratings
CREATE OR REPLACE FUNCTION update_template_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update average rating and review count for the template
  UPDATE templates SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM template_reviews
      WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM template_reviews
      WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
    )
  WHERE id = COALESCE(NEW.template_id, OLD.template_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update template favorites count
CREATE OR REPLACE FUNCTION update_template_favorites_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update favorites count for the template
  UPDATE templates SET
    favorites_count = (
      SELECT COUNT(*)
      FROM template_favorites
      WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
    )
  WHERE id = COALESCE(NEW.template_id, OLD.template_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update review helpful count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update helpful count for the review
  UPDATE template_reviews SET
    helpful_count = (
      SELECT COUNT(*)
      FROM review_helpful_votes
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id) AND is_helpful = true
    )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updates
DROP TRIGGER IF EXISTS update_template_rating_trigger ON template_reviews;
CREATE TRIGGER update_template_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON template_reviews
  FOR EACH ROW EXECUTE FUNCTION update_template_rating();

DROP TRIGGER IF EXISTS update_template_favorites_count_trigger ON template_favorites;
CREATE TRIGGER update_template_favorites_count_trigger
  AFTER INSERT OR DELETE ON template_favorites
  FOR EACH ROW EXECUTE FUNCTION update_template_favorites_count();

DROP TRIGGER IF EXISTS update_review_helpful_count_trigger ON review_helpful_votes;
CREATE TRIGGER update_review_helpful_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON review_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION update_review_helpful_count();

-- Sample collections data
INSERT INTO template_collections (name, description, template_ids, bundle_price, discount_percent, category) VALUES
('E-commerce Starter Pack', 'Complete set of templates for e-commerce automation', ARRAY[]::UUID[], 75.00, 25, 'ecommerce'),
('CRM Complete Suite', 'Comprehensive CRM automation templates', ARRAY[]::UUID[], 120.00, 30, 'crm'),
('DevOps Professional', 'Advanced DevOps and deployment templates', ARRAY[]::UUID[], 150.00, 35, 'devops'),
('Marketing Automation Bundle', 'Multi-channel marketing automation templates', ARRAY[]::UUID[], 95.00, 20, 'marketing')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE template_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Template Reviews - Anyone can read, only authenticated users can insert/update their own
CREATE POLICY "Anyone can view template reviews" ON template_reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reviews" ON template_reviews FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own reviews" ON template_reviews FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own reviews" ON template_reviews FOR DELETE USING (auth.uid()::text = user_id);

-- Template Favorites - Users can only manage their own favorites
CREATE POLICY "Users can view their own favorites" ON template_favorites FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own favorites" ON template_favorites FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own favorites" ON template_favorites FOR DELETE USING (auth.uid()::text = user_id);

-- Template Collections - Anyone can read
CREATE POLICY "Anyone can view template collections" ON template_collections FOR SELECT USING (true);

-- Review Helpful Votes - Users can manage their own votes
CREATE POLICY "Users can view review votes" ON review_helpful_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own votes" ON review_helpful_votes FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own votes" ON review_helpful_votes FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own votes" ON review_helpful_votes FOR DELETE USING (auth.uid()::text = user_id);