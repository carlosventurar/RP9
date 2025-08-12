import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SSOConfig {
  provider: 'google' | 'azure' | 'okta' | 'auth0' | 'saml'
  config: {
    // Google
    googleClientId?: string
    googleClientSecret?: string
    googleDomain?: string
    
    // Azure AD
    azureTenantId?: string
    azureClientId?: string
    azureClientSecret?: string
    
    // Okta
    oktaDomain?: string
    oktaClientId?: string
    oktaClientSecret?: string
    
    // Auth0
    auth0Domain?: string
    auth0ClientId?: string
    auth0ClientSecret?: string
    
    // SAML
    samlEntryPoint?: string
    samlCertificate?: string
    samlIssuer?: string
    samlCallbackUrl?: string
  }
  enabled: boolean
}

interface SSOConfigRequest {
  tenantId: string
  ssoConfig: SSOConfig
}

const validateSSOConfig = (provider: string, config: any): string[] => {
  const errors: string[] = []

  switch (provider) {
    case 'google':
      if (!config.googleClientId) errors.push('Google Client ID es requerido')
      if (!config.googleClientSecret) errors.push('Google Client Secret es requerido')
      break
      
    case 'azure':
      if (!config.azureTenantId) errors.push('Azure Tenant ID es requerido')
      if (!config.azureClientId) errors.push('Azure Client ID es requerido')
      if (!config.azureClientSecret) errors.push('Azure Client Secret es requerido')
      break
      
    case 'okta':
      if (!config.oktaDomain) errors.push('Okta Domain es requerido')
      if (!config.oktaClientId) errors.push('Okta Client ID es requerido')
      if (!config.oktaClientSecret) errors.push('Okta Client Secret es requerido')
      break
      
    case 'auth0':
      if (!config.auth0Domain) errors.push('Auth0 Domain es requerido')
      if (!config.auth0ClientId) errors.push('Auth0 Client ID es requerido')
      if (!config.auth0ClientSecret) errors.push('Auth0 Client Secret es requerido')
      break
      
    case 'saml':
      if (!config.samlEntryPoint) errors.push('SAML Entry Point es requerido')
      if (!config.samlCertificate) errors.push('SAML Certificate es requerido')
      if (!config.samlIssuer) errors.push('SAML Issuer es requerido')
      break
  }

  return errors
}

const encryptSensitiveData = (config: any): any => {
  // En un entorno real, esto debería usar encriptación real
  // Por ahora simulamos con base64 para indicar que está "encriptado"
  const sensitiveFields = [
    'googleClientSecret',
    'azureClientSecret', 
    'oktaClientSecret',
    'auth0ClientSecret',
    'samlCertificate'
  ]

  const encrypted = { ...config }
  
  for (const field of sensitiveFields) {
    if (encrypted[field]) {
      encrypted[field] = Buffer.from(encrypted[field]).toString('base64')
    }
  }

  return encrypted
}

const decryptSensitiveData = (config: any): any => {
  const sensitiveFields = [
    'googleClientSecret',
    'azureClientSecret',
    'oktaClientSecret', 
    'auth0ClientSecret',
    'samlCertificate'
  ]

  const decrypted = { ...config }

  for (const field of sensitiveFields) {
    if (decrypted[field]) {
      try {
        decrypted[field] = Buffer.from(decrypted[field], 'base64').toString()
      } catch (error) {
        // Si no se puede decodificar, mantener el valor original
      }
    }
  }

  return decrypted
}

const testSSOConnection = async (provider: string, config: any): Promise<{
  success: boolean
  error?: string
  details?: any
}> => {
  try {
    switch (provider) {
      case 'google':
        // Test Google OAuth endpoint
        const googleResponse = await fetch(
          `https://accounts.google.com/.well-known/openid-configuration`
        )
        if (!googleResponse.ok) {
          throw new Error('No se pudo conectar con Google OAuth')
        }
        break

      case 'azure':
        // Test Azure AD endpoint
        const azureResponse = await fetch(
          `https://login.microsoftonline.com/${config.azureTenantId}/.well-known/openid-configuration`
        )
        if (!azureResponse.ok) {
          throw new Error('No se pudo conectar con Azure AD')
        }
        break

      case 'okta':
        // Test Okta endpoint
        const oktaResponse = await fetch(
          `https://${config.oktaDomain}/.well-known/openid-configuration`
        )
        if (!oktaResponse.ok) {
          throw new Error('No se pudo conectar con Okta')
        }
        break

      case 'auth0':
        // Test Auth0 endpoint
        const auth0Response = await fetch(
          `https://${config.auth0Domain}/.well-known/openid-configuration`
        )
        if (!auth0Response.ok) {
          throw new Error('No se pudo conectar con Auth0')
        }
        break

      case 'saml':
        // Para SAML, validamos que el certificado tenga formato correcto
        if (!config.samlCertificate.includes('BEGIN CERTIFICATE')) {
          throw new Error('Formato de certificado SAML inválido')
        }
        break
    }

    return { success: true }
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      details: error
    }
  }
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  try {
    // Validar autenticación
    const authHeader = event.headers.authorization
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token de autorización requerido' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token inválido' })
      }
    }

    const tenantId = event.queryStringParameters?.tenantId || 
                    (event.body && JSON.parse(event.body).tenantId)

    if (!tenantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'tenantId es requerido' })
      }
    }

    // Verificar permisos del tenant (solo owner puede configurar SSO)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, plan')
      .eq('id', tenantId)
      .eq('owner_user_id', user.id)
      .single()

    if (tenantError || !tenant) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Solo el propietario del tenant puede configurar SSO' })
      }
    }

    // Verificar que el plan permita SSO
    const plansWithSSO = ['pro', 'enterprise']
    if (!plansWithSSO.includes(tenant.plan)) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: 'SSO requiere plan Pro o Enterprise',
          currentPlan: tenant.plan,
          upgradeUrl: '/billing'
        })
      }
    }

    switch (event.httpMethod) {
      case 'GET':
        // Obtener configuración SSO actual
        const { data: ssoConfig, error: getError } = await supabase
          .from('tenant_sso_config')
          .select('provider, config, enabled')
          .eq('tenant_id', tenantId)
          .single()

        if (getError && getError.code !== 'PGRST116') { // No encontrado es OK
          throw new Error(`Error getting SSO config: ${getError.message}`)
        }

        let responseConfig = null
        if (ssoConfig) {
          responseConfig = {
            provider: ssoConfig.provider,
            config: decryptSensitiveData(ssoConfig.config),
            enabled: ssoConfig.enabled
          }

          // Remover datos sensibles para el response
          const configCopy = { ...responseConfig.config }
          const sensitiveFields = [
            'googleClientSecret',
            'azureClientSecret',
            'oktaClientSecret',
            'auth0ClientSecret',
            'samlCertificate'
          ]

          for (const field of sensitiveFields) {
            if (configCopy[field]) {
              configCopy[field] = '***REDACTED***'
            }
          }

          responseConfig.config = configCopy
        }

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ssoConfig: responseConfig })
        }

      case 'POST':
      case 'PUT':
        // Crear o actualizar configuración SSO
        const { ssoConfig: newConfig }: SSOConfigRequest = JSON.parse(event.body || '{}')

        if (!newConfig || !newConfig.provider || !newConfig.config) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Configuración SSO incompleta' })
          }
        }

        // Validar configuración
        const validationErrors = validateSSOConfig(newConfig.provider, newConfig.config)
        if (validationErrors.length > 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Configuración SSO inválida',
              details: validationErrors
            })
          }
        }

        // Test de conexión (solo si enabled = true)
        if (newConfig.enabled) {
          const connectionTest = await testSSOConnection(newConfig.provider, newConfig.config)
          if (!connectionTest.success) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                error: 'Test de conexión SSO falló',
                details: connectionTest.error
              })
            }
          }
        }

        // Encriptar datos sensibles
        const encryptedConfig = encryptSensitiveData(newConfig.config)

        // Guardar configuración
        const { data: savedConfig, error: saveError } = await supabase
          .from('tenant_sso_config')
          .upsert({
            tenant_id: tenantId,
            provider: newConfig.provider,
            config: encryptedConfig,
            enabled: newConfig.enabled,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'tenant_id'
          })
          .select()
          .single()

        if (saveError) {
          throw new Error(`Error saving SSO config: ${saveError.message}`)
        }

        // Log de auditoría
        await supabase
          .from('audit_logs')
          .insert({
            tenant_id: tenantId,
            user_id: user.id,
            action: event.httpMethod === 'POST' ? 'sso_config_create' : 'sso_config_update',
            resource: 'sso_config',
            resource_id: tenantId,
            details: { 
              provider: newConfig.provider,
              enabled: newConfig.enabled
            }
          })

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true,
            message: 'Configuración SSO guardada exitosamente'
          })
        }

      case 'DELETE':
        // Eliminar configuración SSO
        const { error: deleteError } = await supabase
          .from('tenant_sso_config')
          .delete()
          .eq('tenant_id', tenantId)

        if (deleteError) {
          throw new Error(`Error deleting SSO config: ${deleteError.message}`)
        }

        // Log de auditoría
        await supabase
          .from('audit_logs')
          .insert({
            tenant_id: tenantId,
            user_id: user.id,
            action: 'sso_config_delete',
            resource: 'sso_config',
            resource_id: tenantId
          })

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true,
            message: 'Configuración SSO eliminada exitosamente'
          })
        }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Método no permitido' })
        }
    }

  } catch (error: any) {
    console.error('SSO Config Error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
}