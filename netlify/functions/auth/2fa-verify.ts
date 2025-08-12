import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import * as speakeasy from 'speakeasy'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Verify2FARequest {
  token: string
  isBackupCode?: boolean
  sessionToken?: string
}

interface BackupCode {
  code: string
  used: boolean
}

const decryptSecret = (encryptedSecret: string): string => {
  try {
    return Buffer.from(encryptedSecret, 'base64').toString()
  } catch (error) {
    throw new Error('Error descifrando secreto 2FA')
  }
}

const decryptBackupCodes = (encryptedCodes: string): BackupCode[] => {
  try {
    return JSON.parse(Buffer.from(encryptedCodes, 'base64').toString())
  } catch (error) {
    throw new Error('Error descifrando códigos de backup')
  }
}

const encryptBackupCodes = (codes: BackupCode[]): string => {
  return Buffer.from(JSON.stringify(codes)).toString('base64')
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    }
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

    const { token: totpToken, isBackupCode = false, sessionToken }: Verify2FARequest = JSON.parse(event.body || '{}')

    if (!totpToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'token es requerido' })
      }
    }

    // Obtener configuración 2FA del usuario
    const { data: user2FA, error: get2FAError } = await supabase
      .from('user_2fa')
      .select('totp_secret, backup_codes, enabled')
      .eq('user_id', user.id)
      .single()

    if (get2FAError || !user2FA) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '2FA no está configurado para este usuario' })
      }
    }

    if (!user2FA.enabled) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '2FA no está habilitado' })
      }
    }

    let isValid = false
    let backupCodeUsed = false

    if (isBackupCode) {
      // Verificar código de backup
      if (!user2FA.backup_codes) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No hay códigos de backup disponibles' })
        }
      }

      const backupCodes = decryptBackupCodes(user2FA.backup_codes)
      const codeIndex = backupCodes.findIndex(c => c.code === totpToken.toUpperCase() && !c.used)

      if (codeIndex >= 0) {
        isValid = true
        backupCodeUsed = true

        // Marcar código como usado
        backupCodes[codeIndex].used = true

        // Actualizar códigos en la base de datos
        await supabase
          .from('user_2fa')
          .update({
            backup_codes: encryptBackupCodes(backupCodes)
          })
          .eq('user_id', user.id)

        // Verificar si quedan códigos disponibles
        const remainingCodes = backupCodes.filter(c => !c.used).length
        if (remainingCodes <= 2) {
          // Enviar alerta de códigos de backup agotándose (implementar después)
          console.warn(`Usuario ${user.id} tiene solo ${remainingCodes} códigos de backup restantes`)
        }
      }
    } else {
      // Verificar código TOTP
      const decryptedSecret = decryptSecret(user2FA.totp_secret)
      
      isValid = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: totpToken,
        window: 2 // Permite cierta tolerancia de tiempo
      })
    }

    if (!isValid) {
      // Log de intento fallido
      await supabase
        .from('audit_logs')
        .insert({
          tenant_id: null,
          user_id: user.id,
          action: '2fa_verify_failed',
          resource: 'user_2fa',
          resource_id: user.id,
          details: { 
            isBackupCode,
            ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip']
          },
          ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
          user_agent: event.headers['user-agent']
        })

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: isBackupCode ? 'Código de backup inválido' : 'Código TOTP inválido'
        })
      }
    }

    // Actualizar último uso
    await supabase
      .from('user_2fa')
      .update({
        last_used_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    // Log de verificación exitosa
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: null,
        user_id: user.id,
        action: '2fa_verify_success',
        resource: 'user_2fa',
        resource_id: user.id,
        details: { 
          isBackupCode,
          backupCodeUsed: isBackupCode ? totpToken : null
        },
        ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
        user_agent: event.headers['user-agent']
      })

    // Si se proporciona sessionToken, actualizar la sesión como verificada con 2FA
    if (sessionToken) {
      await supabase
        .from('auth_sessions')
        .update({
          two_fa_verified: true,
          last_activity_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken)
        .eq('user_id', user.id)
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        verified: true,
        message: isBackupCode 
          ? 'Código de backup verificado exitosamente'
          : 'Código 2FA verificado exitosamente',
        backupCodeUsed: backupCodeUsed ? totpToken : null
      })
    }

  } catch (error: any) {
    console.error('2FA Verify Error:', error)
    
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