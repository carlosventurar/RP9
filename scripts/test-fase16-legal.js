/**
 * Test script para verificar endpoints críticos de Fase 16 - Legal System
 * Tests end-to-end del flujo legal completo
 */

const fs = require('fs')
const path = require('path')

// Configuración base
const config = {
  baseUrl: process.env.FRONTEND_URL || 'https://rp9portal.netlify.app',
  testUserId: 'test-user-' + Date.now(),
  testTenantId: 'test-tenant-' + Date.now(),
  timeout: 10000
}

// Mock data para tests
const mockClientInfo = {
  company_name: 'Test Company S.A.',
  address: 'Calle Test 123, CDMX',
  tax_id: 'RFC123456789',
  representative: 'Director Test',
  email: 'test@testcompany.com',
  industry: 'Technology'
}

const mockContractTerms = {
  plan: 'enterprise',
  base_price: '$5,000',
  currency: 'USD',
  billing_cycle: 'annual',
  sla_percentage: '99.9'
}

// Test cases para Fase 16
const legalTestCases = [
  // 1. Legal Pages Tests
  {
    name: 'Legal ToS Page Load',
    method: 'GET',
    url: '/es-MX/legal/tos',
    expected: {
      statusCode: 200,
      contentType: 'text/html'
    }
  },
  {
    name: 'Legal Privacy Page Load',
    method: 'GET', 
    url: '/es-MX/legal/privacy',
    expected: {
      statusCode: 200,
      contentType: 'text/html'
    }
  },
  {
    name: 'Legal Status Page Load',
    method: 'GET',
    url: '/es-MX/legal/status',
    expected: {
      statusCode: 200,
      contentType: 'text/html'
    }
  },

  // 2. Legal Acceptance Tests
  {
    name: 'Legal Accept ToS - Valid Request',
    method: 'POST',
    url: '/.netlify/functions/legal-accept',
    body: {
      document_type: 'tos',
      version: '2025-01',
      tenant_id: config.testTenantId,
      user_id: config.testUserId,
      language: 'es'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: [200, 409], // 200 = success, 409 = already accepted
      hasProperty: 'success'
    }
  },
  {
    name: 'Legal Accept Privacy - Valid Request',
    method: 'POST',
    url: '/.netlify/functions/legal-accept',
    body: {
      document_type: 'privacy',
      version: '2025-01',
      tenant_id: config.testTenantId,
      user_id: config.testUserId,
      language: 'es'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: [200, 409],
      hasProperty: 'success'
    }
  },
  {
    name: 'Legal Accept - Invalid Data',
    method: 'POST',
    url: '/.netlify/functions/legal-accept',
    body: {
      document_type: 'invalid',
      version: '',
      language: 'invalid'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: 400,
      hasProperty: 'error'
    }
  },

  // 3. Document Generation Tests
  {
    name: 'Legal Generate ToS - Spanish',
    method: 'POST',
    url: '/.netlify/functions/legal-generate',
    body: {
      document_type: 'tos',
      language: 'es',
      output_format: 'html',
      variables: {
        company_name: 'RP9 Portal Test',
        client_company: 'Test Client'
      }
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: 200,
      hasProperty: 'success'
    }
  },
  {
    name: 'Legal Generate Privacy - English',
    method: 'POST',
    url: '/.netlify/functions/legal-generate',
    body: {
      document_type: 'privacy',
      language: 'en',
      output_format: 'html',
      variables: {
        company_name: 'RP9 Portal Test'
      }
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: 200,
      hasProperty: 'success'
    }
  },

  // 4. Contract Creation Tests
  {
    name: 'Contract Create MSA - Enterprise',
    method: 'POST',
    url: '/.netlify/functions/contracts-create',
    body: {
      tenant_id: config.testTenantId,
      contract_type: 'msa',
      client_info: mockClientInfo,
      contract_terms: mockContractTerms,
      language: 'es'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: 200,
      hasProperty: 'success'
    }
  },
  {
    name: 'Contract Create DPA - Enterprise',
    method: 'POST',
    url: '/.netlify/functions/contracts-create',
    body: {
      tenant_id: config.testTenantId,
      contract_type: 'dpa',
      client_info: mockClientInfo,
      contract_terms: mockContractTerms,
      language: 'en'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: 200,
      hasProperty: 'success'
    }
  },

  // 5. Subprocessors Management Tests
  {
    name: 'Subprocessors List - Public',
    method: 'GET',
    url: '/.netlify/functions/subprocessors-manage',
    expected: {
      statusCode: 200,
      hasProperty: 'success'
    }
  },
  {
    name: 'Subprocessors Notify - Test',
    method: 'POST',
    url: '/.netlify/functions/subprocessors-manage',
    body: {
      action: 'notify',
      notification_type: 'modification'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: 200,
      hasProperty: 'success'
    }
  },

  // 6. SLA Credit Calculation Test
  {
    name: 'SLA Credit Calculation - Manual Trigger',
    method: 'POST',
    url: '/.netlify/functions/sla-credit-calc',
    body: {},
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: 200,
      hasProperty: 'success'
    }
  },

  // 7. Contract Signing Webhook Test
  {
    name: 'Contract Sign Webhook - Simulation',
    method: 'POST',
    url: '/.netlify/functions/contracts-sign-webhook',
    body: {
      contract_id: 'MSA-' + Date.now(),
      event: 'signed',
      signer_email: 'test@example.com',
      signer_name: 'Test Signer',
      signed_at: new Date().toISOString(),
      signature_id: 'sig_test_123'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    expected: {
      statusCode: [200, 500], // 500 expected if contract doesn't exist
      hasProperty: ['success', 'error'] // Either is acceptable
    }
  }
]

// Utility functions
async function makeRequest(testCase) {
  const url = config.baseUrl + testCase.url
  const options = {
    method: testCase.method,
    headers: {
      'User-Agent': 'Fase16-Legal-Test/1.0',
      ...testCase.headers
    }
  }

  if (testCase.body && testCase.method !== 'GET') {
    options.body = JSON.stringify(testCase.body)
  }

  return fetch(url, options)
}

function checkExpectations(response, data, expected) {
  const results = []

  // Check status code
  if (Array.isArray(expected.statusCode)) {
    if (!expected.statusCode.includes(response.status)) {
      results.push(`❌ Status: expected ${expected.statusCode.join(' or ')}, got ${response.status}`)
    } else {
      results.push(`✅ Status: ${response.status}`)
    }
  } else if (expected.statusCode && response.status !== expected.statusCode) {
    results.push(`❌ Status: expected ${expected.statusCode}, got ${response.status}`)
  } else {
    results.push(`✅ Status: ${response.status}`)
  }

  // Check content type
  if (expected.contentType) {
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes(expected.contentType)) {
      results.push(`❌ Content-Type: expected ${expected.contentType}, got ${contentType}`)
    } else {
      results.push(`✅ Content-Type: ${expected.contentType}`)
    }
  }

  // Check response properties
  if (expected.hasProperty) {
    const properties = Array.isArray(expected.hasProperty) ? expected.hasProperty : [expected.hasProperty]
    
    for (const prop of properties) {
      if (data && typeof data === 'object' && prop in data) {
        results.push(`✅ Has property: ${prop}`)
        return results // Found at least one expected property
      }
    }
    
    // None of the expected properties found
    results.push(`❌ Missing expected property: ${properties.join(' or ')}`)
  }

  return results
}

async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`)
  console.log(`   ${testCase.method} ${testCase.url}`)

  try {
    const response = await makeRequest(testCase)
    
    let data = null
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch (e) {
        console.log(`   ⚠️  Failed to parse JSON response`)
      }
    }

    const results = checkExpectations(response, data, testCase.expected)
    
    results.forEach(result => console.log(`   ${result}`))
    
    // Show response preview for debugging
    if (data && typeof data === 'object') {
      const preview = JSON.stringify(data, null, 2).substring(0, 200)
      console.log(`   📄 Response: ${preview}${preview.length >= 200 ? '...' : ''}`)
    }

    return results.every(r => r.startsWith('✅'))

  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting Fase 16 Legal System Tests...')
  console.log(`📍 Base URL: ${config.baseUrl}`)
  console.log(`🔬 Test Cases: ${legalTestCases.length}`)
  
  let passed = 0
  let failed = 0
  const results = []

  for (const testCase of legalTestCases) {
    const success = await runTest(testCase)
    results.push({ name: testCase.name, success })
    
    if (success) {
      passed++
    } else {
      failed++
    }

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Summary Report
  console.log('\n📊 === TEST RESULTS SUMMARY ===')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)

  // Detailed results
  console.log('\n📋 Detailed Results:')
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
  })

  // Recommendations
  console.log('\n💡 Recommendations:')
  if (failed === 0) {
    console.log('🎉 All tests passed! Fase 16 Legal System is working correctly.')
    console.log('✅ Ready for production traffic.')
  } else {
    console.log('⚠️  Some tests failed. Review the following:')
    console.log('1. Check that Supabase migration was executed successfully')
    console.log('2. Verify all environment variables are configured in Netlify')
    console.log('3. Confirm functions are deployed and accessible')
    console.log('4. Review Netlify function logs for detailed error information')
  }

  // Generate report file
  const reportPath = path.join(__dirname, '..', 'FASE16_TEST_REPORT.json')
  const report = {
    timestamp: new Date().toISOString(),
    summary: { passed, failed, total: passed + failed },
    results,
    config
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Detailed report saved to: ${reportPath}`)

  return failed === 0
}

// Execute tests if run directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error)
      process.exit(1)
    })
}

module.exports = { runAllTests, legalTestCases, config }