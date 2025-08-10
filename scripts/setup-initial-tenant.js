const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function setupInitialTenant() {
  console.log('🚀 Configurando tenant inicial para RP9...')
  
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

  try {
    // Primero verificar si ya existe un tenant RP9
    console.log('🔍 Verificando si ya existe tenant RP9...')
    const { data: existingTenant, error: checkError } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', 'rp9')
      .single()

    if (existingTenant) {
      console.log('✅ Tenant RP9 ya existe:')
      console.log(`   - Nombre: ${existingTenant.name}`)
      console.log(`   - Plan: ${existingTenant.plan}`)
      console.log(`   - Creado: ${existingTenant.created_at}`)
      return existingTenant
    }

    // Crear usuario temporal para ser owner del tenant
    console.log('👤 Creando usuario administrador inicial...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@rp9portal.com',
      password: 'RP9Admin2024!',
      email_confirm: true,
      user_metadata: {
        name: 'Administrador RP9',
        role: 'admin'
      }
    })

    if (authError) {
      console.error('❌ Error creando usuario:', authError.message)
      return null
    }

    const userId = authData.user.id
    console.log('✅ Usuario administrador creado:', authData.user.email)

    // Crear tenant inicial RP9
    console.log('🏢 Creando tenant inicial RP9...')
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'RP9 Portal',
        slug: 'rp9',
        plan: 'empresarial',
        owner_user_id: userId,
        n8n_base_url: process.env.N8N_BASE_URL,
        n8n_api_key: process.env.N8N_API_KEY,
        settings: {
          theme: 'dark',
          language: 'es',
          notifications: true,
          auto_deploy: false,
          dashboard_refresh: 30000
        },
        metadata: {
          created_via: 'production_setup',
          version: '1.0.0',
          environment: 'production',
          setup_date: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (tenantError) {
      console.error('❌ Error creando tenant:', tenantError.message)
      return null
    }

    console.log('✅ Tenant RP9 creado exitosamente:')
    console.log(`   - ID: ${newTenant.id}`)
    console.log(`   - Nombre: ${newTenant.name}`)
    console.log(`   - Plan: ${newTenant.plan}`)
    console.log(`   - Owner: ${authData.user.email}`)

    // Crear suscripción activa para el tenant
    console.log('💳 Creando suscripción empresarial...')
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        tenant_id: newTenant.id,
        status: 'activo',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 año
        metadata: {
          plan: 'empresarial',
          setup_type: 'initial_setup'
        }
      })
      .select()
      .single()

    if (subError) {
      console.warn('⚠️ Advertencia creando suscripción:', subError.message)
    } else {
      console.log('✅ Suscripción creada exitosamente')
    }

    // Crear log de auditoría inicial
    console.log('📝 Creando log de auditoría inicial...')
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: newTenant.id,
        user_id: userId,
        action: 'tenant_created',
        resource: 'tenant',
        resource_id: newTenant.id,
        details: {
          method: 'production_setup',
          plan: 'empresarial',
          timestamp: new Date().toISOString()
        }
      })

    console.log('\n🎉 ¡Configuración inicial completada exitosamente!')
    console.log('📋 Credenciales del administrador:')
    console.log('   - Email: admin@rp9portal.com')
    console.log('   - Password: RP9Admin2024!')
    console.log('\n⚠️  IMPORTANTE: Cambia la contraseña después del primer login')
    
    return newTenant

  } catch (error) {
    console.error('❌ Error en configuración inicial:', error.message)
    return null
  }
}

if (require.main === module) {
  setupInitialTenant()
}

module.exports = setupInitialTenant