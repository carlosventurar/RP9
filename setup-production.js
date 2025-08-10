const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function setupProduction() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  console.log('🚀 Setting up RP9 production database...')
  console.log('🔗 Database URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  
  try {
    // Test connection first
    console.log('🔍 Testing connection...')
    const { data: testData, error: testError } = await supabase
      .from('pg_stat_user_tables')
      .select('schemaname')
      .limit(1)

    if (testError) {
      console.error('❌ Connection test failed:', testError.message)
      return
    }
    console.log('✅ Connection successful!')

    // Check if our tables already exist
    console.log('🔍 Checking existing tables...')
    const { data: existingTables } = await supabase.rpc('check_tables_exist')
    
    if (existingTables === null) {
      console.log('📦 Tables do not exist, creating schema...')
      
      // Read and execute the migration
      const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_initial_schema.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      console.log('⚡ Executing database migration...')
      // We'll copy-paste the SQL manually into Supabase SQL Editor
      console.log('📋 Please copy the following SQL and execute it in Supabase SQL Editor:')
      console.log('🔗 Go to: https://supabase.com/dashboard/project/qovenmrjzljmblxobgfs/sql')
      console.log('=' * 80)
      console.log(migrationSQL)
      console.log('=' * 80)
    } else {
      console.log('✅ Tables already exist!')
    }

    // Create initial tenant for Crossnet/RP9
    console.log('🏢 Setting up initial tenant...')
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', 'rp9')
      .single()

    if (tenantError && tenantError.code === 'PGRST116') {
      // Tenant doesn't exist, create it
      const { data: newTenant, error: createError } = await supabase
        .from('tenants')
        .insert({
          name: 'RP9 Portal',
          slug: 'rp9', 
          plan: 'enterprise',
          n8n_base_url: process.env.N8N_BASE_URL,
          n8n_api_key: process.env.N8N_API_KEY,
          owner_user_id: '00000000-0000-0000-0000-000000000000', // Temporary, will be updated when user registers
          settings: {
            theme: 'dark',
            notifications: true,
            auto_deploy: false
          },
          metadata: {
            created_via: 'production_setup',
            version: '1.0.0'
          }
        })
        .select()
        .single()

      if (createError) {
        console.error('❌ Failed to create tenant:', createError.message)
      } else {
        console.log('✅ Initial tenant created:', newTenant.name)
      }
    } else {
      console.log('✅ Tenant already exists:', tenant?.name || 'RP9 Portal')
    }

    console.log('')
    console.log('🎉 Production setup completed!')
    console.log('📋 Next steps:')
    console.log('   1. Execute the SQL migration in Supabase Dashboard')
    console.log('   2. Configure authentication settings')
    console.log('   3. Deploy to Netlify')
    console.log('')

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
  }
}

setupProduction()