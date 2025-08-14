#!/usr/bin/env node

/**
 * Script para exportar mensajes i18n desde Supabase a archivos JSON
 * Uso: npm run export-i18n [locale]
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Configuración
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuración de rutas
const OUTPUT_DIR = join(__dirname, '..', 'src', 'i18n', 'messages')
const SUPPORTED_LOCALES = [
  'es-419', 'es-MX', 'es-CO', 'es-CL', 
  'es-PE', 'es-AR', 'es-DO', 'en-US'
]

interface I18nMessage {
  locale: string
  namespace: string
  message_key: string
  message_value: string
  description?: string
  status: string
}

interface NestedMessages {
  [key: string]: string | NestedMessages
}

/**
 * Convierte mensajes planos a estructura anidada
 * Ejemplo: "billing.tax_id_label" -> { billing: { tax_id_label: "valor" } }
 */
function nestMessages(messages: I18nMessage[]): NestedMessages {
  const nested: NestedMessages = {}
  
  for (const message of messages) {
    const keys = message.message_key.split('.')
    let current = nested
    
    // Crear estructura anidada
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key] as NestedMessages
    }
    
    // Asignar valor final
    const finalKey = keys[keys.length - 1]
    current[finalKey] = message.message_value
  }
  
  return nested
}

/**
 * Exporta mensajes para un locale específico
 */
async function exportLocaleMessages(locale: string): Promise<void> {
  console.log(`📥 Exportando mensajes para locale: ${locale}`)
  
  try {
    const { data: messages, error } = await supabase
      .from('i18n_messages')
      .select('*')
      .eq('locale', locale)
      .eq('status', 'active')
      .order('namespace', { ascending: true })
      .order('message_key', { ascending: true })
    
    if (error) {
      throw new Error(`Error fetching messages for ${locale}: ${error.message}`)
    }
    
    if (!messages || messages.length === 0) {
      console.log(`⚠️  No active messages found for locale: ${locale}`)
      return
    }
    
    console.log(`   Found ${messages.length} messages`)
    
    // Convertir a estructura anidada
    const nestedMessages = nestMessages(messages)
    
    // Crear directorio si no existe
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true })
    }
    
    // Escribir archivo JSON
    const filename = `${locale}.json`
    const filepath = join(OUTPUT_DIR, filename)
    const jsonContent = JSON.stringify(nestedMessages, null, 2)
    
    writeFileSync(filepath, jsonContent, 'utf-8')
    console.log(`✅ Exported: ${filename} (${messages.length} messages)`)
    
    // Estadísticas por namespace
    const namespaces = [...new Set(messages.map(m => m.namespace))]
    console.log(`   Namespaces: ${namespaces.join(', ')}`)
    
  } catch (error) {
    console.error(`❌ Error exporting ${locale}:`, error)
    throw error
  }
}

/**
 * Crea mensajes base si la tabla está vacía
 */
async function seedBaseMessages(): Promise<void> {
  console.log('🌱 Checking if base messages need to be seeded...')
  
  const { data: existingMessages } = await supabase
    .from('i18n_messages')
    .select('id')
    .limit(1)
  
  if (existingMessages && existingMessages.length > 0) {
    console.log('   Base messages already exist, skipping seed')
    return
  }
  
  console.log('   Seeding base messages...')
  
  const baseMessages = [
    // Common messages
    { locale: 'es-419', namespace: 'common', message_key: 'loading', message_value: 'Cargando...', description: 'Loading indicator' },
    { locale: 'es-419', namespace: 'common', message_key: 'error', message_value: 'Error', description: 'General error message' },
    { locale: 'es-419', namespace: 'common', message_key: 'success', message_value: 'Éxito', description: 'Success message' },
    { locale: 'es-419', namespace: 'common', message_key: 'save', message_value: 'Guardar', description: 'Save button' },
    { locale: 'es-419', namespace: 'common', message_key: 'cancel', message_value: 'Cancelar', description: 'Cancel button' },
    
    // Billing messages
    { locale: 'es-419', namespace: 'billing', message_key: 'per_month', message_value: 'mes', description: 'Per month billing cycle' },
    { locale: 'es-419', namespace: 'billing', message_key: 'per_year', message_value: 'año', description: 'Per year billing cycle' },
    { locale: 'es-419', namespace: 'billing', message_key: 'billed_monthly', message_value: 'Facturado mensualmente', description: 'Monthly billing description' },
    { locale: 'es-419', namespace: 'billing', message_key: 'billed_yearly', message_value: 'Facturado anualmente', description: 'Yearly billing description' },
    { locale: 'es-419', namespace: 'billing', message_key: 'tax_id_required', message_value: 'Identificación fiscal requerida', description: 'Tax ID required message' },
    { locale: 'es-419', namespace: 'billing', message_key: 'invalid_tax_id', message_value: 'Formato de identificación fiscal inválido', description: 'Invalid tax ID format' },
    
    // Currency messages
    { locale: 'es-419', namespace: 'currency', message_key: 'showing_usd', message_value: 'Mostrando precios en USD', description: 'USD price display message' },
    { locale: 'es-419', namespace: 'currency', message_key: 'showing_local', message_value: 'Mostrando precios locales', description: 'Local price display message' },
    { locale: 'es-419', namespace: 'currency', message_key: 'toggle_usd', message_value: 'Ver en USD', description: 'Toggle to USD button' },
    
    // English translations
    { locale: 'en-US', namespace: 'common', message_key: 'loading', message_value: 'Loading...', description: 'Loading indicator' },
    { locale: 'en-US', namespace: 'common', message_key: 'error', message_value: 'Error', description: 'General error message' },
    { locale: 'en-US', namespace: 'common', message_key: 'success', message_value: 'Success', description: 'Success message' },
    { locale: 'en-US', namespace: 'common', message_key: 'save', message_value: 'Save', description: 'Save button' },
    { locale: 'en-US', namespace: 'common', message_key: 'cancel', message_value: 'Cancel', description: 'Cancel button' },
    
    { locale: 'en-US', namespace: 'billing', message_key: 'per_month', message_value: 'month', description: 'Per month billing cycle' },
    { locale: 'en-US', namespace: 'billing', message_key: 'per_year', message_value: 'year', description: 'Per year billing cycle' },
    { locale: 'en-US', namespace: 'billing', message_key: 'billed_monthly', message_value: 'Billed monthly', description: 'Monthly billing description' },
    { locale: 'en-US', namespace: 'billing', message_key: 'billed_yearly', message_value: 'Billed yearly', description: 'Yearly billing description' },
    { locale: 'en-US', namespace: 'billing', message_key: 'tax_id_required', message_value: 'Tax ID required', description: 'Tax ID required message' },
    { locale: 'en-US', namespace: 'billing', message_key: 'invalid_tax_id', message_value: 'Invalid tax ID format', description: 'Invalid tax ID format' },
    
    { locale: 'en-US', namespace: 'currency', message_key: 'showing_usd', message_value: 'Showing USD prices', description: 'USD price display message' },
    { locale: 'en-US', namespace: 'currency', message_key: 'showing_local', message_value: 'Showing local prices', description: 'Local price display message' },
    { locale: 'en-US', namespace: 'currency', message_key: 'toggle_local', message_value: 'View in local currency', description: 'Toggle to local currency button' },
  ]
  
  const { error } = await supabase
    .from('i18n_messages')
    .insert(baseMessages.map(msg => ({
      ...msg,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })))
  
  if (error) {
    console.error('❌ Error seeding base messages:', error)
    throw error
  }
  
  console.log(`✅ Seeded ${baseMessages.length} base messages`)
}

/**
 * Sincroniza mensajes desde archivos JSON existentes hacia Supabase
 */
async function syncFromExistingFiles(): Promise<void> {
  console.log('🔄 Syncing existing JSON files to database...')
  
  const existingFile = join(OUTPUT_DIR, 'es.json')
  
  try {
    if (existsSync(existingFile)) {
      const content = await import(existingFile)
      console.log('   Found existing messages, syncing to database...')
      
      // Flatten nested structure to database format
      const messages: Omit<I18nMessage, 'status'>[] = []
      
      function flattenMessages(obj: any, prefix = '', namespace = 'common') {
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key
          
          if (typeof value === 'string') {
            messages.push({
              locale: 'es-419', // Convert old 'es' to new 'es-419'
              namespace,
              message_key: fullKey,
              message_value: value as string,
              description: `Imported from existing ${existingFile}`
            })
          } else if (typeof value === 'object' && value !== null) {
            flattenMessages(value, fullKey, fullKey.split('.')[0] || namespace)
          }
        }
      }
      
      flattenMessages(content.default || content)
      
      if (messages.length > 0) {
        const { error } = await supabase
          .from('i18n_messages')
          .upsert(
            messages.map(msg => ({
              ...msg,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })),
            { 
              onConflict: 'locale,namespace,message_key',
              ignoreDuplicates: false 
            }
          )
        
        if (error) {
          console.error('❌ Error syncing messages:', error)
        } else {
          console.log(`✅ Synced ${messages.length} messages from existing files`)
        }
      }
    }
  } catch (error) {
    console.log('   No existing files to sync or sync failed:', error)
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🌍 RP9 Portal - I18n Export Script')
  console.log('=====================================')
  
  const targetLocale = process.argv[2]
  
  try {
    // Test database connection
    const { error: connectionError } = await supabase.from('i18n_messages').select('id').limit(1)
    if (connectionError) {
      throw new Error(`Database connection failed: ${connectionError.message}`)
    }
    
    console.log('✅ Connected to Supabase')
    
    // Seed base messages if needed
    await seedBaseMessages()
    
    // Sync from existing files
    await syncFromExistingFiles()
    
    // Export messages
    if (targetLocale) {
      if (!SUPPORTED_LOCALES.includes(targetLocale)) {
        console.error(`❌ Unsupported locale: ${targetLocale}`)
        console.log(`   Supported locales: ${SUPPORTED_LOCALES.join(', ')}`)
        process.exit(1)
      }
      
      await exportLocaleMessages(targetLocale)
    } else {
      console.log('📦 Exporting all supported locales...')
      
      for (const locale of SUPPORTED_LOCALES) {
        await exportLocaleMessages(locale)
      }
    }
    
    console.log('\n✅ Export completed successfully!')
    console.log(`   Messages exported to: ${OUTPUT_DIR}`)
    
  } catch (error) {
    console.error('❌ Export failed:', error)
    process.exit(1)
  }
}

// Run script
main().catch(console.error)