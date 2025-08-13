// RP9 Orchestrator Bridge - Netlify Function
// Secure proxy between Netlify Functions and VPS Orchestrator service

import { Handler } from '@netlify/functions'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// Environment variables
const ORCH_BASE_URL = process.env.ORCHESTRATOR_BASE_URL || 'https://orchestrator.rp9.io'
const JWT_SECRET = process.env.JWT_SECRET!
const HMAC_SECRET = process.env.HMAC_SECRET!

export const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Only POST requests are allowed',
        timestamp: new Date().toISOString()
      })
    }
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    }
  }

  try {
    // Parse and validate request
    const body = event.body ? JSON.parse(event.body) : {}
    const { action, endpoint, payload = {}, tenant_id, user_id } = body

    console.log('Orchestrator bridge request:', {
      action,
      endpoint,
      tenant_id: tenant_id?.substring(0, 8) + '...',
      user_id: user_id?.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    })

    // Validate required fields
    if (!action || !endpoint) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad request',
          message: 'Missing required fields: action, endpoint',
          timestamp: new Date().toISOString()
        })
      }
    }

    // Validate endpoint path
    const allowedEndpoints = [
      '/tenants',
      '/tenants/:id/scale',
      '/tenants/:id/backup',
      '/tenants/:id/promote',
      '/autoscale/run',
      '/enforcement/run',
      '/health',
      '/metrics/tenant/:id'
    ]

    const isValidEndpoint = allowedEndpoints.some(pattern => {
      const regex = new RegExp('^' + pattern.replace(':id', '[a-zA-Z0-9-]+') + '$')
      return regex.test(endpoint)
    })

    if (!isValidEndpoint) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'Endpoint not allowed',
          timestamp: new Date().toISOString()
        })
      }
    }

    // Create JWT for orchestrator authentication
    const jwtPayload = {
      tenant_id,
      user_id,
      role: 'service_role', // Bridge has service role permissions
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
    }

    const jwtToken = jwt.sign(jwtPayload, JWT_SECRET)

    // Create HMAC signature for request integrity
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const requestBody = JSON.stringify(payload)
    const hmacPayload = `${timestamp}\n${requestBody}`
    const hmacSignature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(hmacPayload)
      .digest('hex')

    // Prepare orchestrator request
    const orchestratorUrl = `${ORCH_BASE_URL}${endpoint}`
    const orchestratorHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
      'x-timestamp': timestamp,
      'x-rp9-signature': hmacSignature,
      'x-correlation-id': crypto.randomUUID(),
      'User-Agent': 'RP9-Bridge/1.0'
    }

    console.log('Proxying to orchestrator:', {
      url: orchestratorUrl,
      method: action,
      headers: {
        ...orchestratorHeaders,
        'Authorization': 'Bearer [REDACTED]',
        'x-rp9-signature': '[REDACTED]'
      }
    })

    // Make request to orchestrator
    const orchestratorResponse = await fetch(orchestratorUrl, {
      method: action.toUpperCase(),
      headers: orchestratorHeaders,
      body: requestBody,
      timeout: 30000 // 30 second timeout
    })

    // Get response data
    const responseData = await orchestratorResponse.text()
    let responseJson: any

    try {
      responseJson = JSON.parse(responseData)
    } catch (e) {
      responseJson = {
        error: 'Invalid response',
        message: 'Orchestrator returned non-JSON response',
        data: responseData.substring(0, 500),
        timestamp: new Date().toISOString()
      }
    }

    console.log('Orchestrator response:', {
      status: orchestratorResponse.status,
      success: orchestratorResponse.ok,
      data_length: responseData.length
    })

    // Return response
    return {
      statusCode: orchestratorResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ...responseJson,
        bridge_metadata: {
          proxied_at: new Date().toISOString(),
          orchestrator_status: orchestratorResponse.status,
          request_id: orchestratorHeaders['x-correlation-id']
        }
      })
    }

  } catch (error) {
    console.error('Bridge error:', error)

    // Handle fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Service unavailable',
          message: 'Unable to connect to orchestrator service',
          timestamp: new Date().toISOString()
        })
      }
    }

    // Handle timeout errors
    if (error instanceof Error && error.message.includes('timeout')) {
      return {
        statusCode: 504,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Gateway timeout',
          message: 'Orchestrator request timed out',
          timestamp: new Date().toISOString()
        })
      }
    }

    // Generic error response
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Bridge processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

// Export for testing
export { handler as orchBridge }