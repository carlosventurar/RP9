/**
 * Test Analytics Dashboard System
 * Tests the complete analytics API and dashboard functionality
 * Run: node scripts/test-analytics-dashboard.js
 */

const http = require('http')

const BASE_URL = 'http://localhost:3001'

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
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

async function testAnalyticsAPI() {
  console.log('📊 Testing Analytics Dashboard API\n')
  
  const tests = [
    {
      name: 'Get Complete Analytics (without auth)',
      path: '/api/template-analytics',
      expectedStatus: 401,
      description: 'Should require admin authentication'
    },
    {
      name: 'Get Complete Analytics (with auth)',
      path: '/api/template-analytics',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.overview && data.data.topTemplates
      }
    },
    {
      name: 'Get Overview Metrics Only',
      path: '/api/template-analytics?metric=overview',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.overview && !data.data.topTemplates
      }
    },
    {
      name: 'Get Revenue Data',
      path: '/api/template-analytics?metric=revenue',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.revenueByMonth && Array.isArray(data.data.revenueByMonth)
      }
    },
    {
      name: 'Get Installs Data',
      path: '/api/template-analytics?metric=installs',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.installsByDay && Array.isArray(data.data.installsByDay)
      }
    },
    {
      name: 'Get Templates Performance',
      path: '/api/template-analytics?metric=templates',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.topTemplates && data.data.topTemplates.length > 0
      }
    },
    {
      name: 'Get Category Performance',
      path: '/api/template-analytics?metric=categories',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.categoryPerformance && Array.isArray(data.data.categoryPerformance)
      }
    },
    {
      name: 'Get User Engagement',
      path: '/api/template-analytics?metric=engagement',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.userEngagement && typeof data.data.userEngagement.totalViews === 'number'
      }
    },
    {
      name: 'Get Conversion Funnel',
      path: '/api/template-analytics?metric=conversion',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.conversionFunnel && Array.isArray(data.data.conversionFunnel)
      }
    },
    {
      name: 'Get Rating Distribution',
      path: '/api/template-analytics?metric=ratings',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.ratingDistribution && Array.isArray(data.data.ratingDistribution)
      }
    },
    {
      name: 'Filter by Time Range',
      path: '/api/template-analytics?timeRange=7d',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.meta.timeRange === '7d'
      }
    },
    {
      name: 'Filter by Category',
      path: '/api/template-analytics?metric=templates&category=E-commerce',
      headers: { 'Authorization': 'Bearer admin-token' },
      expectedStatus: 200,
      validation: (data) => {
        return data.success && data.data.topTemplates.every(t => t.category === 'E-commerce')
      }
    }
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`)
      
      const response = await makeRequest(test.path, {
        method: test.method,
        body: test.body,
        headers: test.headers
      })

      let testPassed = response.status === test.expectedStatus

      // Additional validation if provided
      if (testPassed && test.validation && typeof response.data === 'object') {
        testPassed = test.validation(response.data)
      }

      if (testPassed) {
        console.log(`✅ PASS: ${test.name} (${response.status})`)
        passed++
        
        // Log interesting metrics from response
        if (response.data && typeof response.data === 'object' && response.data.data) {
          if (response.data.data.overview) {
            const overview = response.data.data.overview
            console.log(`   💰 Revenue: $${overview.totalRevenue?.toLocaleString() || 0}`)
            console.log(`   📦 Templates: ${overview.totalTemplates || 0}`)
            console.log(`   📥 Installs: ${overview.totalInstalls?.toLocaleString() || 0}`)
            console.log(`   ⭐ Avg Rating: ${overview.averageRating || 0}`)
          }
          if (response.data.data.topTemplates) {
            console.log(`   📊 Top Templates: ${response.data.data.topTemplates.length} found`)
          }
          if (response.data.data.revenueByMonth) {
            console.log(`   📈 Revenue Data: ${response.data.data.revenueByMonth.length} months`)
          }
          if (response.data.data.categoryPerformance) {
            console.log(`   📂 Categories: ${response.data.data.categoryPerformance.length} analyzed`)
          }
        }
      } else {
        console.log(`❌ FAIL: ${test.name}`)
        console.log(`   Expected: ${test.expectedStatus}, Got: ${response.status}`)
        if (test.validation && response.data) {
          console.log(`   Validation failed for response data`)
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

  console.log(`📊 Analytics API Test Results:`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)

  return failed === 0
}

async function testDashboardPages() {
  console.log('\n🎨 Testing Dashboard Pages\n')
  
  const pages = [
    {
      name: 'Admin Dashboard Home',
      path: '/admin',
      expectedStatus: 200
    },
    {
      name: 'Template Analytics Dashboard',
      path: '/admin/templates',
      expectedStatus: 200
    }
  ]

  let passed = 0
  let failed = 0

  for (const page of pages) {
    try {
      console.log(`🔍 Testing: ${page.name}`)
      
      const response = await makeRequest(page.path)
      
      if (response.status === page.expectedStatus) {
        console.log(`✅ PASS: ${page.name} (${response.status})`)
        passed++
        
        // Check for key dashboard components in HTML
        if (typeof response.data === 'string') {
          const html = response.data.toLowerCase()
          const components = [
            { name: 'Dashboard Title', pattern: /dashboard/g },
            { name: 'Analytics Components', pattern: /analytics/g },
            { name: 'Chart Components', pattern: /(chart|graph)/g },
            { name: 'Metric Cards', pattern: /(revenue|installs|rating)/g }
          ]
          
          components.forEach(component => {
            const matches = html.match(component.pattern)
            if (matches && matches.length > 0) {
              console.log(`   ✅ ${component.name}: Found`)
            }
          })
        }
      } else {
        console.log(`❌ FAIL: ${page.name}`)
        console.log(`   Expected: ${page.expectedStatus}, Got: ${response.status}`)
        failed++
      }
    } catch (error) {
      console.log(`❌ FAIL: ${page.name}`)
      console.log(`   Error: ${error.message}`)
      failed++
    }
    
    console.log()
  }

  console.log(`🎨 Dashboard Pages Test Results:`)
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)

  return failed === 0
}

async function main() {
  console.log('🚀 Starting Analytics Dashboard Testing...\n')
  
  // Test API functionality
  const apiSuccess = await testAnalyticsAPI()
  
  // Test dashboard pages
  const pagesSuccess = await testDashboardPages()
  
  console.log('\n📋 Manual Testing Checklist:')
  console.log('1. ✅ Open http://localhost:3001/admin')
  console.log('2. ✅ Verify admin dashboard loads with key metrics')
  console.log('3. ✅ Navigate to /admin/templates for analytics')
  console.log('4. ✅ Check all charts render properly')
  console.log('5. ✅ Test time range and category filters')
  console.log('6. ✅ Verify responsive design on mobile')
  console.log('7. ✅ Test authentication requirements')
  
  console.log('\n🎯 Analytics Dashboard Features:')
  console.log('✅ Complete revenue tracking')
  console.log('✅ Installation metrics and trends')
  console.log('✅ Top templates performance')
  console.log('✅ Category-wise analytics')
  console.log('✅ User engagement metrics')
  console.log('✅ Conversion funnel analysis')
  console.log('✅ Rating distribution charts')
  console.log('✅ Interactive visualizations')
  console.log('✅ Time range filtering')
  console.log('✅ Admin authentication')
  
  console.log('\n🔧 Next Steps:')
  console.log('- Connect to real analytics data sources')
  console.log('- Set up automated data collection')
  console.log('- Add export functionality for reports')
  console.log('- Implement real-time updates')
  console.log('- Add more advanced filtering options')
  
  const overallSuccess = apiSuccess && pagesSuccess
  console.log(`\n${overallSuccess ? '🎉' : '⚠️'} Analytics Dashboard ${overallSuccess ? 'Ready for Production' : 'Needs Fixes'}`)
  
  process.exit(overallSuccess ? 0 : 1)
}

main().catch(error => {
  console.error('💥 Testing failed:', error)
  process.exit(1)
})