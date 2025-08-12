import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'
import * as crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Enable2FARequest {
  step: 'generate' | 'verify' | 'complete'
  totpToken?: string
  secret?: string
}

interface BackupCode {
  code: string
  used: boolean
}

const generateBackupCodes = (): BackupCode[] => {
  const codes: BackupCode[] = []
  
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push({ code, used: false })
  }
  
  return codes
}

const encryptSecret = (secret: string): string => {
  // En producción, usar encriptación real con una clave secreta
  // Por ahora usamos base64 como placeholder
  return Buffer.from(secret).toString('base64')
}

const decryptSecret = (encryptedSecret: string): string => {
  try {
    return Buffer.from(encryptedSecret, 'base64').toString()
  } catch (error) {
    throw new Error('Error descifrando secreto 2FA')
  }
}

const encryptBackupCodes = (codes: BackupCode[]): string => {
  // En producción, usar encriptación real
  return Buffer.from(JSON.stringify(codes)).toString('base64')
}

const decryptBackupCodes = (encryptedCodes: string): BackupCode[] => {
  try {
    return JSON.parse(Buffer.from(encryptedCodes, 'base64').toString())
  } catch (error) {
    throw new Error('Error descifrando códigos de backup')
  }
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

    const { step, totpToken, secret }: Enable2FARequest = JSON.parse(event.body || '{}')

    if (!step) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'step es requerido' })
      }
    }

    // Verificar si el usuario ya tiene 2FA habilitado
    const { data: existing2FA } = await supabase
      .from('user_2fa')
      .select('enabled')
      .eq('user_id', user.id)
      .single()

    if (existing2FA?.enabled && step !== 'generate') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '2FA ya está habilitado para este usuario' })
      }
    }

    switch (step) {
      case 'generate':
        // Paso 1: Generar secreto TOTP y QR code
        const newSecret = speakeasy.generateSecret({
          name: `RP9 (${user.email})`,
          issuer: process.env.TOTP_ISSUER || 'RP9',
          length: parseInt(process.env.OTP_SECRET_LENGTH || '32')
        })

        // Generar QR code
        const qrCodeUrl = await QRCode.toDataURL(newSecret.otpauth_url!)

        // Guardar secreto temporalmente (sin habilitar aún)
        await supabase
          .from('user_2fa')
          .upsert({
            user_id: user.id,
            totp_secret: encryptSecret(newSecret.base32),
            enabled: false
          }, {
            onConflict: 'user_id'
          })

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            step: 'verify',
            secret: newSecret.base32,
            qrCode: qrCodeUrl,
            manualEntryKey: newSecret.base32,
            message: 'Escanea el código QR con tu app de autenticación y verifica con un código'
          })
        }

      case 'verify':
        // Paso 2: Verificar que el usuario puede generar códigos TOTP válidos
        if (!totpToken || !secret) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'totpToken y secret son requeridos para verificación' })
          }
        }

        // Verificar el token TOTP
        const isValid = speakeasy.totp.verify({
          secret: secret,
          encoding: 'base32',
          token: totpToken,
          window: 2 // Permite cierta tolerancia de tiempo
        })

        if (!isValid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Código TOTP inválido' })
          }
        }

        // Generar códigos de backup
        const backupCodes = generateBackupCodes()

        // Habilitar 2FA y guardar códigos de backup
        await supabase
          .from('user_2fa')
          .upsert({
            user_id: user.id,
            totp_secret: encryptSecret(secret),
            backup_codes: encryptBackupCodes(backupCodes),
            enabled: true,
            enabled_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        // Log de auditoría
        await supabase
          .from('audit_logs')
          .insert({
            tenant_id: null, // 2FA es a nivel usuario, no tenant
            user_id: user.id,
            action: '2fa_enabled',
            resource: 'user_2fa',
            resource_id: user.id,
            ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
            user_agent: event.headers['user-agent']
          })

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            step: 'complete',
            backupCodes: backupCodes.map(c => c.code),
            message: '2FA habilitado exitosamente. Guarda los códigos de backup en un lugar seguro.'
          })
        }

      case 'complete':
        // Paso 3: Confirmación final (opcional, ya se completó en verify)
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            message: '2FA configurado completamente'
          })
        }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Paso inválido' })
        }
    }

  } catch (error: any) {
    console.error('2FA Enable Error:', error)
    
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