const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  try {
    console.log('Creating admin user...')
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@agentevirtualia.com',
      password: 'AgenteVirtualIA2024!',
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        name: 'Admin User',
        created_by: 'script'
      }
    })

    if (error) {
      console.error('Error creating admin user:', error.message)
      return
    }

    console.log('✅ Admin user created successfully!')
    console.log('Email: admin@agentevirtualia.com')
    console.log('Password: AgenteVirtualIA2024!')
    console.log('User ID:', data.user.id)
    
  } catch (error) {
    console.error('Script error:', error.message)
  }
}

createAdminUser()