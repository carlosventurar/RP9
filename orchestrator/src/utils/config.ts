// Agente Virtual IA Orchestrator - Configuration Management
import { OrchestratorConfig } from '@/types'

export function loadConfig(): OrchestratorConfig {
  const requiredEnvVars = [
    'JWT_SECRET',
    'HMAC_SECRET',
    'POSTGRES_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'S3_ENDPOINT',
    'S3_BUCKET',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'TRAEFIK_DOMAIN',
    'ACME_EMAIL',
    'SHARED_N8N_BASE_URL',
    'SHARED_N8N_API_KEY',
    'REDIS_URL'
  ]

  // Verificar variables requeridas
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }

  return {
    port: parseInt(process.env.PORT || '8080', 10),
    jwt_secret: process.env.JWT_SECRET!,
    hmac_secret: process.env.HMAC_SECRET!,
    postgres_url: process.env.POSTGRES_URL!,
    supabase_url: process.env.SUPABASE_URL!,
    supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    stripe_secret_key: process.env.STRIPE_SECRET_KEY!,
    s3_endpoint: process.env.S3_ENDPOINT!,
    s3_bucket: process.env.S3_BUCKET!,
    s3_access_key: process.env.S3_ACCESS_KEY!,
    s3_secret_key: process.env.S3_SECRET_KEY!,
    traefik_domain: process.env.TRAEFIK_DOMAIN!,
    acme_email: process.env.ACME_EMAIL!,
    n8n_image: process.env.N8N_IMAGE || 'n8nio/n8n:latest',
    db_password: process.env.DB_PASSWORD || 'changeme123',
    shared_n8n_base_url: process.env.SHARED_N8N_BASE_URL!,
    shared_n8n_api_key: process.env.SHARED_N8N_API_KEY!,
    redis_url: process.env.REDIS_URL!
  }
}

export const config = loadConfig()