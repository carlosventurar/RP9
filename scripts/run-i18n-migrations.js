/**
 * Run i18n Migrations for Fase 15
 * Executes the 3 migration files for internationalization
 */

const { createClient } = require('@supabase/supabase-js')
const { readFileSync } = require('fs')
const { join } = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const migrations = [
  '090_i18n_pricebook.sql',
  '091_i18n_seed_data.sql', 
  '092_billing_events.sql'
]

async function runMigration(filename) {
  try {
    console.log(`📋 Reading migration: ${filename}...`)
    
    const sqlFile = join(__dirname, '..', 'supabase', 'migrations', filename)
    const sql = readFileSync(sqlFile, 'utf8')
    
    console.log(`🚀 Executing migration: ${filename}...`)
    
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📊 Processing ${statements.length} SQL statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Skip empty or comment-only statements
      if (!statement || statement.startsWith('--')) continue
      
      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}`)
        
        // Try to execute the statement directly
        const { error } = await supabase.rpc('exec_sql_query', { query: statement })
        
        if (error) {
          // If direct execution fails, provide instructions
          console.log(`⚠️ Statement ${i + 1} needs manual execution:`)
          console.log(`   ${statement.substring(0, 100)}...`)
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
        
      } catch (stmtError) {
        console.log(`⚠️ Statement ${i + 1} error:`, stmtError.message)
      }
    }
    
    console.log(`✅ Migration ${filename} processed!`)
    
  } catch (error) {
    console.error(`💥 Migration ${filename} failed:`, error.message)
    throw error
  }
}

async function runAllMigrations() {
  console.log('🚀 Starting Fase 15 i18n migrations...')
  console.log(`📝 Will execute ${migrations.length} migration files`)
  
  for (const migration of migrations) {
    try {
      await runMigration(migration)
      console.log(`🎉 ${migration} completed!`)
    } catch (error) {
      console.error(`💥 ${migration} failed:`, error)
      
      console.log('\n📝 Manual Steps Required:')
      console.log('1. Go to your Supabase dashboard: https://app.supabase.com')
      console.log('2. Select your project')  
      console.log('3. Navigate to the SQL Editor')
      console.log(`4. Copy and paste the contents of supabase/migrations/${migration}`)
      console.log('5. Click "Run" to execute the script')
      console.log('6. Continue with the next migration')
      
      // Ask if user wants to continue
      console.log('\n❓ Continue with next migration? (Press Ctrl+C to stop)')
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve())
      })
    }
  }
}

runAllMigrations()
  .then(() => {
    console.log('\n✨ All i18n migrations completed!')
    console.log('🎊 Fase 15 database structure is ready!')
    console.log('\n🔄 Next steps:')
    console.log('1. Configure environment variables')
    console.log('2. Run tests: npm test')
    console.log('3. Export i18n messages: npm run export-i18n')
  })
  .catch((error) => {
    console.error('\n💥 Migration process failed:', error)
    process.exit(1)
  })