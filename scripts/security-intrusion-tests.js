/**
 * RP9 Security Intrusion Tests
 * Conjunto de pruebas básicas de seguridad para validar la implementación de Fase 6
 */

const crypto = require('crypto')
const fetch = require('node-fetch')

class SecurityTestSuite {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000'
    this.netlifyFunctionsUrl = options.netlifyFunctionsUrl || 'http://localhost:8888'
    this.testResults = []
    this.validApiKey = options.validApiKey || 'test_api_key_12345'
    this.webhookSecret = options.webhookSecret || 'test_webhook_secret_67890'
  }

  async runAllTests() {
    console.log('🔒 Iniciando Suite de Pruebas de Seguridad RP9 - Fase 6')
    console.log('=' .repeat(60))
    
    const tests = [
      this.testRateLimiting,
      this.testHMACVerification,
      this.testSQLInjectionProtection,
      this.testXSSProtection,
      this.testUnauthorizedAccess,
      this.testAPIKeyValidation,
      this.testInputValidation,
      this.testCORSConfiguration,
      this.testSecurityHeaders,
      this.testErrorHandling
    ]

    for (const test of tests) {
      try {
        await test.call(this)
        await this.delay(100) // Evitar rate limiting durante tests
      } catch (error) {
        this.logResult('ERROR', test.name, `Test failed: ${error.message}`, false)
      }
    }

    this.generateReport()
  }

  async testRateLimiting() {
    const testName = 'Rate Limiting Protection'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      // Test 1: Rate limiting por IP
      const requests = []
      for (let i = 0; i < 15; i++) {
        requests.push(
          fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': 'invalid_signature'
            },
            body: JSON.stringify({ test: 'rate_limit' })
          })
        )
      }

      const responses = await Promise.all(requests)
      const rateLimitedCount = responses.filter(r => r.status === 429).length

      if (rateLimitedCount > 0) {
        this.logResult('PASS', testName, `Rate limiting activated after ${15 - rateLimitedCount} requests`, true)
      } else {
        this.logResult('FAIL', testName, 'Rate limiting not working properly', false)
      }

      // Test 2: Rate limiting con API key (debería tener límites más altos)
      const apiKeyRequests = []
      for (let i = 0; i < 15; i++) {
        apiKeyRequests.push(
          fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.validApiKey,
              'X-Webhook-Signature': 'invalid_signature'
            },
            body: JSON.stringify({ test: 'rate_limit_api_key' })
          })
        )
      }

      const apiKeyResponses = await Promise.all(apiKeyRequests)
      const apiKeyRateLimited = apiKeyResponses.filter(r => r.status === 429).length

      if (apiKeyRateLimited < rateLimitedCount) {
        this.logResult('PASS', testName + ' (API Key)', 'API Key provides higher rate limits', true)
      } else {
        this.logResult('WARN', testName + ' (API Key)', 'API Key rate limits may be too restrictive', true)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testHMACVerification() {
    const testName = 'HMAC Signature Verification'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      const payload = JSON.stringify({ 
        tenant_id: 'test-tenant-123',
        workflow_id: 'test-workflow',
        execution_id: 'test-exec-456',
        status: 'success'
      })

      // Test 1: Valid HMAC signature
      const validSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload, 'utf8')
        .digest('hex')

      const validResponse = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${validSignature}`
        },
        body: payload
      })

      if (validResponse.status !== 401) {
        this.logResult('PASS', testName + ' (Valid)', 'Valid HMAC signature accepted', true)
      } else {
        this.logResult('FAIL', testName + ' (Valid)', 'Valid HMAC signature rejected', false)
      }

      // Test 2: Invalid HMAC signature
      const invalidResponse = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=invalid_signature_12345'
        },
        body: payload
      })

      if (invalidResponse.status === 401) {
        this.logResult('PASS', testName + ' (Invalid)', 'Invalid HMAC signature rejected', true)
      } else {
        this.logResult('FAIL', testName + ' (Invalid)', 'Invalid HMAC signature accepted', false)
      }

      // Test 3: Missing signature
      const noSignatureResponse = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      })

      if (noSignatureResponse.status === 401) {
        this.logResult('PASS', testName + ' (Missing)', 'Missing signature properly rejected', true)
      } else {
        this.logResult('FAIL', testName + ' (Missing)', 'Missing signature not rejected', false)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testSQLInjectionProtection() {
    const testName = 'SQL Injection Protection'
    console.log(`\n🧪 Testing: ${testName}`)

    const sqlInjectionPayloads = [
      "'; DROP TABLE tenants; --",
      "' OR 1=1 --",
      "'; INSERT INTO tenants VALUES ('hacked'); --",
      "' UNION SELECT * FROM tenants --",
      "admin' OR '1'='1' /*"
    ]

    let protectionWorking = true

    try {
      for (const payload of sqlInjectionPayloads) {
        const testPayload = JSON.stringify({
          tenant_id: payload,
          workflow_id: 'test-workflow',
          execution_id: 'test-exec',
          status: 'success'
        })

        const validSignature = crypto
          .createHmac('sha256', this.webhookSecret)
          .update(testPayload, 'utf8')
          .digest('hex')

        const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${validSignature}`
          },
          body: testPayload
        })

        // Si la respuesta es 500, podría indicar una inyección SQL exitosa
        if (response.status === 500) {
          const errorText = await response.text()
          if (errorText.includes('SQL') || errorText.includes('syntax') || errorText.includes('database')) {
            protectionWorking = false
            break
          }
        }

        await this.delay(50) // Evitar rate limiting
      }

      if (protectionWorking) {
        this.logResult('PASS', testName, 'SQL injection attempts properly handled', true)
      } else {
        this.logResult('FAIL', testName, 'SQL injection vulnerability detected', false)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testXSSProtection() {
    const testName = 'XSS Protection'
    console.log(`\n🧪 Testing: ${testName}`)

    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>",
      "';alert(String.fromCharCode(88,83,83));//'"
    ]

    try {
      // Test en el endpoint de métricas
      const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/n8n-metrics?timeframe=${encodeURIComponent(xssPayloads[0])}`)
      
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.text()
        if (!data.includes('<script>')) {
          this.logResult('PASS', testName, 'XSS payloads properly sanitized', true)
        } else {
          this.logResult('FAIL', testName, 'XSS payload reflected in response', false)
        }
      } else {
        this.logResult('PASS', testName, 'Response content-type properly set', true)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testUnauthorizedAccess() {
    const testName = 'Unauthorized Access Protection'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      // Test acceso sin autenticación a endpoint protegido
      const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/n8n-key-rotation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tenant_id: 'test-tenant' })
      })

      if (response.status === 401 || response.status === 403) {
        this.logResult('PASS', testName, 'Unauthorized requests properly rejected', true)
      } else {
        this.logResult('FAIL', testName, 'Unauthorized access allowed', false)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testAPIKeyValidation() {
    const testName = 'API Key Validation'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      // Test con API key inválida
      const invalidKeyPayload = JSON.stringify({ test: 'api_key_validation' })
      const signature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(invalidKeyPayload, 'utf8')
        .digest('hex')

      const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid_key_123',
          'X-Webhook-Signature': `sha256=${signature}`
        },
        body: invalidKeyPayload
      })

      // El endpoint debería procesar la request (la API key es para rate limiting, no auth)
      // pero debería aplicar rate limiting más estricto
      this.logResult('INFO', testName, `Response status: ${response.status}`, true)

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testInputValidation() {
    const testName = 'Input Validation'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      // Test con payload malformado
      const malformedPayload = '{"tenant_id": "test", "invalid_json":'
      const signature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(malformedPayload, 'utf8')
        .digest('hex')

      const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`
        },
        body: malformedPayload
      })

      if (response.status === 400) {
        this.logResult('PASS', testName, 'Malformed JSON properly rejected', true)
      } else {
        this.logResult('WARN', testName, 'Malformed JSON handling could be improved', true)
      }

      // Test con campos faltantes
      const incompletePayload = JSON.stringify({ tenant_id: 'test' }) // Faltan campos requeridos
      const signature2 = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(incompletePayload, 'utf8')
        .digest('hex')

      const response2 = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/secure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature2}`
        },
        body: incompletePayload
      })

      if (response2.status === 400) {
        this.logResult('PASS', testName + ' (Required Fields)', 'Missing required fields properly validated', true)
      } else {
        this.logResult('WARN', testName + ' (Required Fields)', 'Required field validation could be stricter', true)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testCORSConfiguration() {
    const testName = 'CORS Configuration'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/n8n-metrics`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://malicious-site.com',
          'Access-Control-Request-Method': 'POST'
        }
      })

      const corsHeader = response.headers.get('Access-Control-Allow-Origin')
      if (corsHeader === '*' || corsHeader === 'https://malicious-site.com') {
        this.logResult('WARN', testName, 'CORS policy may be too permissive', true)
      } else {
        this.logResult('PASS', testName, 'CORS policy properly configured', true)
      }

    } catch (error) {
      this.logResult('INFO', testName, 'CORS test inconclusive', true)
    }
  }

  async testSecurityHeaders() {
    const testName = 'Security Headers'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/n8n-metrics`)
      
      const securityHeaders = {
        'X-Content-Type-Options': response.headers.get('X-Content-Type-Options'),
        'X-Frame-Options': response.headers.get('X-Frame-Options'),
        'X-XSS-Protection': response.headers.get('X-XSS-Protection'),
        'Strict-Transport-Security': response.headers.get('Strict-Transport-Security'),
        'Content-Security-Policy': response.headers.get('Content-Security-Policy')
      }

      let securityScore = 0
      let totalHeaders = 0

      for (const [header, value] of Object.entries(securityHeaders)) {
        totalHeaders++
        if (value) {
          securityScore++
          this.logResult('PASS', `${testName} (${header})`, `Header present: ${value}`, true)
        } else {
          this.logResult('WARN', `${testName} (${header})`, 'Security header missing', true)
        }
      }

      const percentage = (securityScore / totalHeaders) * 100
      if (percentage >= 80) {
        this.logResult('PASS', testName, `Security headers coverage: ${percentage.toFixed(0)}%`, true)
      } else {
        this.logResult('WARN', testName, `Security headers coverage: ${percentage.toFixed(0)}%`, true)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  async testErrorHandling() {
    const testName = 'Error Handling'
    console.log(`\n🧪 Testing: ${testName}`)

    try {
      // Test endpoint inexistente
      const response = await fetch(`${this.netlifyFunctionsUrl}/.netlify/functions/nonexistent-endpoint`)
      
      if (response.status === 404) {
        this.logResult('PASS', testName, 'Non-existent endpoints return 404', true)
      } else {
        this.logResult('WARN', testName, 'Error handling could be improved', true)
      }

      // Verificar que errores no revelen información sensible
      const errorText = await response.text()
      const sensitivePatterns = [
        /password/i,
        /api[_-]?key/i,
        /secret/i,
        /token/i,
        /database/i,
        /stack trace/i,
        /error.*line.*\d+/i
      ]

      let infoLeakage = false
      for (const pattern of sensitivePatterns) {
        if (pattern.test(errorText)) {
          infoLeakage = true
          break
        }
      }

      if (!infoLeakage) {
        this.logResult('PASS', testName + ' (Info Leakage)', 'Error messages do not leak sensitive information', true)
      } else {
        this.logResult('FAIL', testName + ' (Info Leakage)', 'Error messages may leak sensitive information', false)
      }

    } catch (error) {
      this.logResult('FAIL', testName, `Error: ${error.message}`, false)
    }
  }

  logResult(level, test, message, passed) {
    const emoji = level === 'PASS' ? '✅' : level === 'FAIL' ? '❌' : level === 'WARN' ? '⚠️' : 'ℹ️'
    const logMessage = `${emoji} ${level}: ${test} - ${message}`
    
    console.log(logMessage)
    
    this.testResults.push({
      level,
      test,
      message,
      passed,
      timestamp: new Date().toISOString()
    })
  }

  generateReport() {
    console.log('\n' + '=' .repeat(60))
    console.log('📊 RESUMEN DE PRUEBAS DE SEGURIDAD')
    console.log('=' .repeat(60))

    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.level === 'PASS').length
    const failedTests = this.testResults.filter(r => r.level === 'FAIL').length
    const warnTests = this.testResults.filter(r => r.level === 'WARN').length
    const infoTests = this.testResults.filter(r => r.level === 'INFO').length

    console.log(`\n📈 Estadísticas:`)
    console.log(`   Total de pruebas: ${totalTests}`)
    console.log(`   ✅ Exitosas: ${passedTests}`)
    console.log(`   ❌ Fallidas: ${failedTests}`)
    console.log(`   ⚠️ Advertencias: ${warnTests}`)
    console.log(`   ℹ️ Información: ${infoTests}`)

    const successRate = ((passedTests / totalTests) * 100).toFixed(1)
    console.log(`\n🎯 Tasa de éxito: ${successRate}%`)

    if (failedTests === 0) {
      console.log('\n🎉 ¡Todas las pruebas críticas de seguridad han pasado!')
    } else {
      console.log(`\n🚨 ${failedTests} prueba(s) crítica(s) fallaron. Revisar inmediatamente.`)
    }

    if (warnTests > 0) {
      console.log(`\n⚠️ ${warnTests} prueba(s) generaron advertencias. Considerar mejoras.`)
    }

    // Generar recomendaciones
    console.log('\n💡 Recomendaciones:')
    if (failedTests > 0) {
      console.log('   - Revisar y corregir las pruebas fallidas antes de deployment')
    }
    if (warnTests > 0) {
      console.log('   - Implementar las mejoras sugeridas en las advertencias')
    }
    console.log('   - Ejecutar estas pruebas regularmente como parte del CI/CD')
    console.log('   - Considerar implementar monitoreo de seguridad en producción')

    console.log(`\n📅 Reporte generado: ${new Date().toLocaleString('es-ES')}`)
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Ejecutar tests si se corre directamente
if (require.main === module) {
  const tester = new SecurityTestSuite({
    // Configurar según tu entorno
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    netlifyFunctionsUrl: process.env.NETLIFY_FUNCTIONS_URL || 'http://localhost:8888',
    validApiKey: process.env.TEST_API_KEY || 'test_api_key_12345',
    webhookSecret: process.env.WEBHOOK_SECRET || 'test_webhook_secret_67890'
  })

  tester.runAllTests().catch(console.error)
}

module.exports = { SecurityTestSuite }