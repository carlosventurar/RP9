-- Template Reviews System Schema
-- Run this in Supabase SQL editor after templates-schema.sql

-- Template reviews table
CREATE TABLE IF NOT EXISTS template_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review helpfulness tracking (users can mark reviews as helpful)
CREATE TABLE IF NOT EXISTS review_helpfulness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES template_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_reviews_template ON template_reviews(template_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_user ON template_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_rating ON template_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_template_reviews_created ON template_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_helpfulness_review ON review_helpfulness(review_id);

-- RLS Policies
ALTER TABLE template_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpfulness ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY IF NOT EXISTS "Reviews are publicly readable" ON template_reviews
  FOR SELECT USING (true);

-- Users can only insert their own reviews
CREATE POLICY IF NOT EXISTS "Users can insert their own reviews" ON template_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own reviews
CREATE POLICY IF NOT EXISTS "Users can update their own reviews" ON template_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own reviews
CREATE POLICY IF NOT EXISTS "Users can delete their own reviews" ON template_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Anyone can read helpfulness data
CREATE POLICY IF NOT EXISTS "Helpfulness is publicly readable" ON review_helpfulness
  FOR SELECT USING (true);

-- Users can only insert their own helpfulness votes
CREATE POLICY IF NOT EXISTS "Users can insert their own helpfulness votes" ON review_helpfulness
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own helpfulness votes
CREATE POLICY IF NOT EXISTS "Users can update their own helpfulness votes" ON review_helpfulness
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update template average rating
CREATE OR REPLACE FUNCTION update_template_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the average rating for the template
  UPDATE templates 
  SET rating = (
    SELECT ROUND(AVG(rating::numeric), 1)
    FROM template_reviews 
    WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
  )
  WHERE id = COALESCE(NEW.template_id, OLD.template_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to automatically update template rating when reviews change
DROP TRIGGER IF EXISTS update_template_rating_trigger ON template_reviews;
CREATE TRIGGER update_template_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON template_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_template_rating();

-- Function to update review helpful count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the helpful count for the review
  UPDATE template_reviews 
  SET helpful_count = (
    SELECT COUNT(*)
    FROM review_helpfulness 
    WHERE review_id = COALESCE(NEW.review_id, OLD.review_id) 
    AND is_helpful = true
  )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to automatically update helpful count
DROP TRIGGER IF EXISTS update_review_helpful_count_trigger ON review_helpfulness;
CREATE TRIGGER update_review_helpful_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON review_helpfulness
  FOR EACH ROW
  EXECUTE FUNCTION update_review_helpful_count();

-- Verification
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'template_reviews') THEN
    RAISE NOTICE '✅ Template reviews table created successfully';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'review_helpfulness') THEN
    RAISE NOTICE '✅ Review helpfulness table created successfully';
  END IF;
END $$;