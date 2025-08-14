import { z } from 'zod'

const configSchema = z.object({
  // Server config
  PORT: z.number().default(8090),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // CORS
  CORS_ORIGINS: z.string().default('*').transform(val => 
    val === '*' ? true : val.split(',').map(s => s.trim())
  ),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.number().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  
  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_PRIMARY: z.string().default('gpt-4-turbo-preview'),
  AI_MODEL_FALLBACK: z.string().default('claude-3-sonnet-20240229'),
  ENABLED_PROVIDERS: z.string().default('openai,anthropic').transform(val => 
    val.split(',').map(s => s.trim())
  ),
  
  // BYOK (Bring Your Own Key)
  ALLOW_BYOK: z.boolean().default(true),
  
  // Cache
  AI_CACHE_TTL_SEC: z.number().default(600), // 10 minutes
  AI_CACHE_MAX_SIZE: z.number().default(1000),
  
  // Budget & Cost Control
  AI_BUDGET_DEFAULT_USD: z.number().default(20),
  BUDGET_ENFORCEMENT: z.enum(['block', 'warn', 'none']).default('warn'),
  COST_PER_1K_TOKENS_USD: z.number().default(0.02),
  
  // Database
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // n8n integration
  N8N_BASE_URL: z.string(),
  N8N_API_KEY: z.string(),
  N8N_SANDBOX_TTL_MINUTES: z.number().default(30),
  
  // Security
  AI_HMAC_SECRET: z.string().default('change_me_in_production'),
  JWT_SECRET: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // PII Redaction
  REDACT_PII: z.boolean().default(true),
  PII_REPLACEMENT_TOKEN: z.string().default('[REDACTED]'),
  
  // Sandbox
  SANDBOX_ENABLED: z.boolean().default(true),
  SANDBOX_MAX_DURATION_MS: z.number().default(30000), // 30 seconds
})

function loadConfig() {
  const env = {
    PORT: process.env.AI_PORT ? parseInt(process.env.AI_PORT) : undefined,
    HOST: process.env.AI_HOST,
    NODE_ENV: process.env.NODE_ENV,
    
    CORS_ORIGINS: process.env.AI_CORS_ORIGINS,
    
    RATE_LIMIT_MAX: process.env.AI_RATE_LIMIT_MAX ? parseInt(process.env.AI_RATE_LIMIT_MAX) : undefined,
    RATE_LIMIT_WINDOW: process.env.AI_RATE_LIMIT_WINDOW,
    
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AI_MODEL_PRIMARY: process.env.AI_MODEL_PRIMARY,
    AI_MODEL_FALLBACK: process.env.AI_MODEL_FALLBACK,
    ENABLED_PROVIDERS: process.env.AI_ENABLED_PROVIDERS,
    
    ALLOW_BYOK: process.env.AI_ALLOW_BYOK === 'true',
    
    AI_CACHE_TTL_SEC: process.env.AI_CACHE_TTL_SEC ? parseInt(process.env.AI_CACHE_TTL_SEC) : undefined,
    AI_CACHE_MAX_SIZE: process.env.AI_CACHE_MAX_SIZE ? parseInt(process.env.AI_CACHE_MAX_SIZE) : undefined,
    
    AI_BUDGET_DEFAULT_USD: process.env.AI_BUDGET_DEFAULT_USD ? parseFloat(process.env.AI_BUDGET_DEFAULT_USD) : undefined,
    BUDGET_ENFORCEMENT: process.env.AI_BUDGET_ENFORCEMENT,
    COST_PER_1K_TOKENS_USD: process.env.AI_COST_PER_1K_TOKENS_USD ? parseFloat(process.env.AI_COST_PER_1K_TOKENS_USD) : undefined,
    
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    
    N8N_BASE_URL: process.env.N8N_BASE_URL,
    N8N_API_KEY: process.env.N8N_API_KEY,
    N8N_SANDBOX_TTL_MINUTES: process.env.N8N_SANDBOX_TTL_MINUTES ? parseInt(process.env.N8N_SANDBOX_TTL_MINUTES) : undefined,
    
    AI_HMAC_SECRET: process.env.AI_HMAC_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    
    LOG_LEVEL: process.env.AI_LOG_LEVEL,
    
    REDACT_PII: process.env.AI_REDACT_PII !== 'false',
    PII_REPLACEMENT_TOKEN: process.env.AI_PII_REPLACEMENT_TOKEN,
    
    SANDBOX_ENABLED: process.env.AI_SANDBOX_ENABLED !== 'false',
    SANDBOX_MAX_DURATION_MS: process.env.AI_SANDBOX_MAX_DURATION_MS ? parseInt(process.env.AI_SANDBOX_MAX_DURATION_MS) : undefined,
  }

  try {
    return configSchema.parse(env)
  } catch (error) {
    console.error('❌ Invalid configuration:', error)
    process.exit(1)
  }
}

export const config = loadConfig()

// Validate required provider keys
if (config.ENABLED_PROVIDERS.includes('openai') && !config.OPENAI_API_KEY) {
  console.warn('⚠️ OpenAI enabled but OPENAI_API_KEY not provided')
}

if (config.ENABLED_PROVIDERS.includes('anthropic') && !config.ANTHROPIC_API_KEY) {
  console.warn('⚠️ Anthropic enabled but ANTHROPIC_API_KEY not provided')
}

export type Config = typeof config