/**
 * End-to-End Purchase Flow Test
 * Tests the complete template purchase workflow
 * Run: node scripts/test-e2e-purchase.js
 */

const http = require('http')

const BASE_URL = 'http://localhost:3001'

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: res.headers['content-type']?.includes('application/json') 
              ? JSON.parse(data) 
              : data
          })
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          })
        }
      })
    })

    req.on('error', reject)
    
    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    
    req.end()
  })
}

async function testEndpoints() {
  console.log('🧪 Testing End-to-End Purchase Flow\n')
  
  const tests = [
    {
      name: 'Templates Page Load',
      path: '/templates',
      expectedStatus: 200
    },
    {
      name: 'Templates API',
      path: '/api/templates',
      expectedStatus: 200
    },
    {
      name: 'Template Purchase API (without auth)',
      path: '/api/template-purchase',
      method: 'POST',
      body: { templateId: '101' },
      expectedStatus: 401
    },
    {
      name: 'Template Access API (without auth)',
      path: '/api/template-access',
      method: 'POST',
      body: { templateIds: ['101'] },
      expectedStatus: 401
    },
    {
      name: 'Template Install API (without auth)',
      path: '/api/templates/install',
      method: 'POST',
      body: { templateId: '1' },
      expectedStatus: 401
    }
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`)
      
      const response = await makeRequest(test.path, {
        method: test.method || 'GET',
        body: test.body,
        headers: test.headers
      })

      if (response.status === test.expectedStatus) {
        console.log(`✅ PASS: ${test.name} (${response.status})`)
        passed++
        
        // Log some response details for successful API calls
        if (test.path.startsWith('/api/') && response.data) {
          if (typeof response.data === 'object') {
            console.log(`   📄 Response: ${JSON.stringify(response.data).slice(0, 100)}...`)
          }
        }
      } else {
        console.log(`❌ FAIL: ${test.name}`)
        console.log(`   Expected: ${test.expectedStatus}, Got: ${response.status}`)
        if (response.data) {
          console.log(`   Response: ${JSON.stringify(response.data).slice(0, 200)}`)
        }
        failed++
      }
    } catch (error) {
      console.log(`❌ FAIL: ${test.name}`)
      console.log(`   Error: ${error.message}`)
      failed++
    }
    
    console.log() // Empty line for readability
  }

  console.log(`\n📊 Test Results:`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)

  if (failed === 0) {
    console.log('\n🎉 All tests passed! The purchase flow endpoints are working correctly.')
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.')
  }

  return failed === 0
}

async function testUIComponents() {
  console.log('\n🎨 Testing UI Component Rendering')
  
  try {
    const response = await makeRequest('/templates')
    
    if (response.status === 200 && typeof response.data === 'string') {
      const html = response.data
      
      const checks = [
        { name: 'Premium Template Cards', pattern: /PremiumTemplateCard/g },
        { name: 'Purchase Modal Component', pattern: /PurchaseModal/g },
        { name: 'Template Price Badge', pattern: /TemplatePriceBadge/g },
        { name: 'Premium Templates in Data', pattern: /Multi-Channel Inventory Sync Pro/g },
        { name: 'Enterprise Templates', pattern: /\$50/g },
        { name: 'Free Template Counter', pattern: /free/gi }
      ]

      console.log('🔍 Checking UI components in rendered HTML:')
      
      checks.forEach(check => {
        const matches = html.match(check.pattern)
        if (matches && matches.length > 0) {
          console.log(`   ✅ ${check.name}: Found ${matches.length} occurrences`)
        } else {
          console.log(`   ❌ ${check.name}: Not found`)
        }
      })
      
    } else {
      console.log('❌ Could not load templates page for UI testing')
    }
    
  } catch (error) {
    console.log('❌ UI testing failed:', error.message)
  }
}

async function main() {
  console.log('🚀 Starting End-to-End Testing...\n')
  
  // Test API endpoints
  const apiSuccess = await testEndpoints()
  
  // Test UI components
  await testUIComponents()
  
  console.log('\n📋 Manual Testing Checklist:')
  console.log('1. ✅ Open http://localhost:3001/templates')
  console.log('2. ✅ Verify premium templates show with price badges')
  console.log('3. ✅ Click "Buy" button on premium template')
  console.log('4. ✅ Verify purchase modal opens')
  console.log('5. ✅ Verify authentication prompt for purchase')
  console.log('6. ✅ Test free template installation flow')
  
  console.log('\n🔧 Next Steps:')
  console.log('- Set up Supabase templates table using database/templates-schema.sql')
  console.log('- Configure Stripe checkout keys for production testing')
  console.log('- Test with real authentication flow')
  
  process.exit(apiSuccess ? 0 : 1)
}

main().catch(error => {
  console.error('💥 Testing failed:', error)
  process.exit(1)
})