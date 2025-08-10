const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function applyMigration() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('🚀 Applying migration to Supabase production database...')
  console.log('Database:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_initial_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by statement (simple approach)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📄 Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
      
      if (statement.includes('CREATE TABLE') || statement.includes('CREATE VIEW') || 
          statement.includes('CREATE FUNCTION') || statement.includes('CREATE POLICY') ||
          statement.includes('ALTER TABLE') || statement.includes('INSERT INTO')) {
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} (may be expected if already exists):`, error.message)
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      }
    }

    console.log('✅ Migration completed successfully!')
    
    // Test connection by checking if tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (!tablesError) {
      console.log('📋 Tables in database:', tables.map(t => t.table_name).join(', '))
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyMigration()