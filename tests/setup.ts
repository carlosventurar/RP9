import { vi } from 'vitest'

// Mock de variables de entorno para tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'test-hubspot-token'
process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test'
process.env.FRONTEND_URL = 'http://localhost:3000'

// Mock global fetch
global.fetch = vi.fn()

// Mock console para tests más limpios
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}

// Setup para cada test
beforeEach(() => {
  vi.clearAllMocks()
})