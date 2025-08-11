import { Handler } from '@netlify/functions';
import crypto from 'crypto';

// Rate limiting store (in-memory for simplicity)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 300; // 300 requests per minute

// HMAC verification
function verifyHmac(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

// Rate limiting
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip;
  const current = rateLimitStore.get(key);
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  current.count++;
  return true;
}

export const handler: Handler = async (event, context) => {
  const { httpMethod, path, headers, body } = event;
  const ip = headers['x-forwarded-for'] || headers['x-real-ip'] || '127.0.0.1';
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-rp9-signature',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded: 300 requests per minute',
      }),
    };
  }

  // HMAC verification for webhooks
  if (path.includes('/webhooks/') && httpMethod === 'POST') {
    const signature = headers['x-rp9-signature'];
    const hmacSecret = process.env.HMAC_SECRET;
    
    if (hmacSecret && hmacSecret !== 'default-secret-change-in-production') {
      if (!signature || !verifyHmac(body || '', signature, hmacSecret)) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Invalid HMAC signature',
          }),
        };
      }
    }
  }

  // n8n proxy
  const n8nBaseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '');
  const n8nApiKey = process.env.N8N_API_KEY;
  
  if (!n8nBaseUrl || !n8nApiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'n8n configuration missing',
        message: 'N8N_BASE_URL and N8N_API_KEY must be configured',
      }),
    };
  }

  try {
    // Extract API path from Netlify function path
    const apiPath = path.replace('/.netlify/functions/n8n-proxy', '');
    const url = `${n8nBaseUrl}/api/v1${apiPath}`;
    
    // Prepare request options
    const requestOptions: RequestInit = {
      method: httpMethod,
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      requestOptions.body = body;
    }

    // Forward request to n8n
    const response = await fetch(url, requestOptions);
    const responseData = await response.text();
    
    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: responseData,
    };
    
  } catch (error: any) {
    console.error('n8n proxy error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'n8n proxy error',
        message: error.message,
      }),
    };
  }
};