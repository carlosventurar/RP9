/**
 * Test script para verificar endpoints críticos de Fase 15
 * Simula requests de diferentes países y monedas
 */

const testEndpoints = [
  {
    name: 'Price book lookup - Mexico MXN',
    url: '/api/pricebook?country=MX&plan=starter&period=monthly',
    expected: { currency: 'MXN' }
  },
  {
    name: 'Price book lookup - Colombia COP', 
    url: '/api/pricebook?country=CO&plan=pro&period=yearly',
    expected: { currency: 'COP' }
  },
  {
    name: 'Price book lookup - USD fallback',
    url: '/api/pricebook?country=FR&plan=starter&period=monthly',
    expected: { currency: 'USD' }
  },
  {
    name: 'Billing checkout - Mexican user',
    url: '/netlify/functions/billing-checkout',
    method: 'POST',
    body: {
      planId: 'starter',
      period: 'monthly', 
      country: 'MX',
      currencyPreference: 'LOCAL'
    },
    expected: { currency: 'MXN' }
  },
  {
    name: 'I18n export - Spanish Mexico',
    url: '/api/i18n/export',
    method: 'POST',
    body: { locale: 'es-MX' },
    expected: { locale: 'es-MX' }
  }
]

async function testEndpoint(endpoint) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  
  try {
    console.log(`🧪 Testing: ${endpoint.name}`)
    
    const options = {
      method: endpoint.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-country': endpoint.body?.country || 'MX',
        'accept-language': 'es-MX,es;q=0.9,en;q=0.8'
      }
    }
    
    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body)
    }
    
    const response = await fetch(baseUrl + endpoint.url, options)
    
    if (!response.ok) {
      console.log(`❌ FAIL: HTTP ${response.status}`)
      return false
    }
    
    const data = await response.json()
    console.log(`📊 Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...')
    
    // Check expected values
    if (endpoint.expected) {
      for (const [key, expectedValue] of Object.entries(endpoint.expected)) {
        if (data[key] !== expectedValue) {
          console.log(`❌ FAIL: Expected ${key}=${expectedValue}, got ${data[key]}`)
          return false
        }
      }
    }
    
    console.log(`✅ PASS`)
    return true
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`)
    return false
  }
}

async function runTests() {
  console.log('🚀 Starting Fase 15 endpoint tests...\n')
  
  let passed = 0
  let failed = 0
  
  for (const endpoint of testEndpoints) {
    const success = await testEndpoint(endpoint)
    if (success) {
      passed++
    } else {
      failed++
    }
    console.log('') // Empty line for readability
  }
  
  console.log('📊 Test Results:')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Fase 15 endpoints are working correctly.')
  } else {
    console.log('\n⚠️ Some tests failed. Review the output above for details.')
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = { runTests, testEndpoints }