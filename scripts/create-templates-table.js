/**
 * Create Templates Table in Supabase
 * Sets up the database schema for the templates marketplace
 * Run: node scripts/create-templates-table.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createTemplatesTable() {
  console.log('🏗️  Creating templates table...')
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create templates table
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

        -- Create template_purchases table for tracking purchases
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

        -- Create template_installs table for tracking installations
        CREATE TABLE IF NOT EXISTS template_installs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          n8n_workflow_id VARCHAR(255) NOT NULL,
          installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          custom_name VARCHAR(255)
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
        CREATE INDEX IF NOT EXISTS idx_templates_price ON templates(price);
        CREATE INDEX IF NOT EXISTS idx_templates_featured ON templates(is_featured);
        CREATE INDEX IF NOT EXISTS idx_templates_rating ON templates(rating);
        CREATE INDEX IF NOT EXISTS idx_template_purchases_user ON template_purchases(user_id);
        CREATE INDEX IF NOT EXISTS idx_template_purchases_template ON template_purchases(template_id);
        CREATE INDEX IF NOT EXISTS idx_template_installs_user ON template_installs(user_id);

        -- Add RLS (Row Level Security) policies
        ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
        ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;
        ALTER TABLE template_installs ENABLE ROW LEVEL SECURITY;

        -- Templates are publicly readable
        CREATE POLICY "Templates are publicly readable" ON templates
          FOR SELECT USING (true);

        -- Only authenticated users can insert/update templates (admin functionality)
        CREATE POLICY "Authenticated users can manage templates" ON templates
          FOR ALL USING (auth.role() = 'authenticated');

        -- Users can only see their own purchases
        CREATE POLICY "Users can view their own purchases" ON template_purchases
          FOR SELECT USING (auth.uid() = user_id);

        -- Users can only insert their own purchases
        CREATE POLICY "Users can insert their own purchases" ON template_purchases
          FOR INSERT WITH CHECK (auth.uid() = user_id);

        -- Users can only see their own installs
        CREATE POLICY "Users can view their own installs" ON template_installs
          FOR SELECT USING (auth.uid() = user_id);

        -- Users can only insert their own installs
        CREATE POLICY "Users can insert their own installs" ON template_installs
          FOR INSERT WITH CHECK (auth.uid() = user_id);

        -- Create updated_at trigger function
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Add trigger to templates table
        CREATE TRIGGER update_templates_updated_at 
          BEFORE UPDATE ON templates 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
      `
    })

    if (error) {
      console.error('❌ Error creating templates table:', error)
      return false
    }

    console.log('✅ Templates table created successfully!')
    return true

  } catch (error) {
    console.error('❌ Fatal error creating table:', error)
    return false
  }
}

// Alternative approach using individual queries if rpc doesn't work
async function createTemplatesTableFallback() {
  console.log('🏗️  Creating templates table (fallback method)...')
  
  try {
    // Check if we can create tables directly via SQL
    const tableSQL = `
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
      )
    `
    
    // Try to execute via PostgREST (may not work for DDL)
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql: tableSQL })
    })

    if (response.ok) {
      console.log('✅ Templates table created successfully!')
      return true
    } else {
      console.log('ℹ️  Direct SQL execution not available. Manual setup required.')
      console.log('📝 Please run this SQL in your Supabase dashboard:')
      console.log('\n' + tableSQL)
      return false
    }

  } catch (error) {
    console.error('❌ Fallback method failed:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting templates table creation...')
  
  // Try main method first
  const success = await createTemplatesTable()
  
  if (!success) {
    console.log('🔄 Trying fallback method...')
    await createTemplatesTableFallback()
  }

  console.log('\n📋 Next steps:')
  console.log('1. Verify the templates table exists in your Supabase dashboard')
  console.log('2. Run: node scripts/populate-premium-templates.js')
  console.log('3. Test the templates API at /api/templates')
}

main()
  .then(() => {
    console.log('\n✨ Table creation script completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })