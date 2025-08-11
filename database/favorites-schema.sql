-- Template Favorites Schema
-- Sprint 3.4: Sistema de Template Favorites

-- Template Favorites table
CREATE TABLE IF NOT EXISTS template_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_id) -- Prevent duplicate favorites
);

-- Collection Favorites table (already created in collections-schema.sql but included for completeness)
CREATE TABLE IF NOT EXISTS collection_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  collection_id UUID NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, collection_id) -- Prevent duplicate favorites
);

-- User Favorite Lists (custom lists created by users)
CREATE TABLE IF NOT EXISTS user_favorite_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorite List Items (templates in custom lists)
CREATE TABLE IF NOT EXISTS favorite_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES user_favorite_lists(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, template_id) -- Prevent duplicate items in same list
);

-- Row Level Security (RLS) Policies
ALTER TABLE template_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_list_items ENABLE ROW LEVEL SECURITY;

-- Template favorites policies
CREATE POLICY "Users can view own template favorites" ON template_favorites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own template favorites" ON template_favorites
  FOR ALL USING (user_id = auth.uid());

-- Collection favorites policies
CREATE POLICY "Users can view own collection favorites" ON collection_favorites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own collection favorites" ON collection_favorites
  FOR ALL USING (user_id = auth.uid());

-- User favorite lists policies
CREATE POLICY "Users can view own favorite lists" ON user_favorite_lists
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view public favorite lists" ON user_favorite_lists
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can manage own favorite lists" ON user_favorite_lists
  FOR ALL USING (user_id = auth.uid());

-- Favorite list items policies
CREATE POLICY "Users can view favorite list items they own" ON favorite_list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_favorite_lists 
      WHERE id = favorite_list_items.list_id 
      AND (user_id = auth.uid() OR is_public = true)
    )
  );

CREATE POLICY "Users can manage items in own favorite lists" ON favorite_list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_favorite_lists 
      WHERE id = favorite_list_items.list_id 
      AND user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_favorites_user ON template_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_template ON template_favorites(template_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_created ON template_favorites(created_at);

CREATE INDEX IF NOT EXISTS idx_collection_favorites_user ON collection_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_favorites_collection ON collection_favorites(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_favorites_created ON collection_favorites(created_at);

CREATE INDEX IF NOT EXISTS idx_user_favorite_lists_user ON user_favorite_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_lists_public ON user_favorite_lists(is_public) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_favorite_list_items_list ON favorite_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_favorite_list_items_template ON favorite_list_items(template_id);

-- Views for easier querying
CREATE OR REPLACE VIEW user_favorites_with_templates AS
SELECT 
  tf.id as favorite_id,
  tf.user_id,
  tf.created_at as favorited_at,
  t.id as template_id,
  t.name as template_name,
  t.description as template_description,
  t.price as template_price,
  t.category as template_category,
  t.is_premium as template_is_premium,
  t.average_rating as template_rating,
  t.total_installs as template_installs,
  t.created_at as template_created_at
FROM template_favorites tf
JOIN templates t ON tf.template_id = t.id;

CREATE OR REPLACE VIEW user_favorites_with_collections AS
SELECT 
  cf.id as favorite_id,
  cf.user_id,
  cf.created_at as favorited_at,
  c.id as collection_id,
  c.name as collection_name,
  c.description as collection_description,
  c.bundle_price as collection_price,
  c.discount_percentage as collection_discount,
  c.template_count,
  c.average_rating as collection_rating,
  c.total_installs as collection_installs,
  c.created_at as collection_created_at
FROM collection_favorites cf
JOIN template_collections c ON cf.collection_id = c.id;

-- Functions for favorite statistics
CREATE OR REPLACE FUNCTION get_user_favorite_stats(user_uuid UUID)
RETURNS TABLE(
  total_template_favorites BIGINT,
  total_collection_favorites BIGINT,
  total_custom_lists BIGINT,
  favorite_categories TEXT[],
  most_favorited_category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM template_favorites WHERE user_id = user_uuid),
    (SELECT COUNT(*) FROM collection_favorites WHERE user_id = user_uuid),
    (SELECT COUNT(*) FROM user_favorite_lists WHERE user_id = user_uuid),
    (SELECT ARRAY_AGG(DISTINCT t.category) 
     FROM template_favorites tf 
     JOIN templates t ON tf.template_id = t.id 
     WHERE tf.user_id = user_uuid),
    (SELECT t.category 
     FROM template_favorites tf 
     JOIN templates t ON tf.template_id = t.id 
     WHERE tf.user_id = user_uuid
     GROUP BY t.category 
     ORDER BY COUNT(*) DESC 
     LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- Function to get popular favorites (trending)
CREATE OR REPLACE FUNCTION get_trending_favorites(days_back INTEGER DEFAULT 7, limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  template_id UUID,
  template_name TEXT,
  template_category TEXT,
  favorite_count BIGINT,
  recent_favorites BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.category,
    COUNT(*) as favorite_count,
    COUNT(*) FILTER (WHERE tf.created_at >= NOW() - INTERVAL '1 day' * days_back) as recent_favorites
  FROM templates t
  JOIN template_favorites tf ON t.id = tf.template_id
  GROUP BY t.id, t.name, t.category
  HAVING COUNT(*) FILTER (WHERE tf.created_at >= NOW() - INTERVAL '1 day' * days_back) > 0
  ORDER BY recent_favorites DESC, favorite_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_favorite_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_favorite_lists 
  SET updated_at = NOW() 
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_favorite_list_timestamp
  AFTER INSERT OR DELETE ON favorite_list_items
  FOR EACH ROW EXECUTE FUNCTION update_favorite_list_timestamp();

-- Sample data for testing
INSERT INTO template_favorites (user_id, template_id) VALUES 
('user-1', 'template-1'),
('user-1', 'template-3'),
('user-1', 'template-5'),
('user-2', 'template-1'),
('user-2', 'template-2'),
('user-3', 'template-1'),
('user-3', 'template-3'),
('user-3', 'template-4'),
('user-4', 'template-5'),
('user-4', 'template-1');

INSERT INTO collection_favorites (user_id, collection_id) VALUES 
('user-1', 'collection-1'),
('user-1', 'collection-4'),
('user-2', 'collection-2'),
('user-3', 'collection-1'),
('user-3', 'collection-3'),
('user-4', 'collection-4');

-- Sample custom favorite lists
INSERT INTO user_favorite_lists (user_id, name, description, is_public) VALUES 
('user-1', 'My E-commerce Tools', 'Templates for my online store project', true),
('user-1', 'Marketing Arsenal', 'All my marketing automation templates', false),
('user-2', 'Development Essentials', 'Core templates for development workflow', true),
('user-3', 'Client Projects', 'Templates I use for client work', false);

-- Sample items in favorite lists
INSERT INTO favorite_list_items (list_id, template_id) VALUES 
((SELECT id FROM user_favorite_lists WHERE name = 'My E-commerce Tools'), 'template-1'),
((SELECT id FROM user_favorite_lists WHERE name = 'My E-commerce Tools'), 'template-2'),
((SELECT id FROM user_favorite_lists WHERE name = 'Marketing Arsenal'), 'template-3'),
((SELECT id FROM user_favorite_lists WHERE name = 'Marketing Arsenal'), 'template-4'),
((SELECT id FROM user_favorite_lists WHERE name = 'Development Essentials'), 'template-5');

COMMENT ON TABLE template_favorites IS 'Individual template favorites by users';
COMMENT ON TABLE collection_favorites IS 'Collection favorites by users';  
COMMENT ON TABLE user_favorite_lists IS 'Custom favorite lists created by users';
COMMENT ON TABLE favorite_list_items IS 'Templates within custom favorite lists';