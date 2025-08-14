import { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { logger, logError } from '@/utils/logger'
import { config } from '@/utils/config'

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the error
  logError(error, {
    url: request.url,
    method: request.method,
    userAgent: request.headers['user-agent'],
    ip: request.ip
  })

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        received: err.received
      }))
    })
    return
  }

  // Handle Fastify validation errors
  if (error.validation) {
    reply.code(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    })
    return
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    reply.code(429).send({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: error.retryAfter || 60
    })
    return
  }

  // Handle AI provider errors
  if (error.message?.includes('OpenAI') || error.message?.includes('Anthropic')) {
    reply.code(502).send({
      error: 'AI Provider Error',
      message: 'AI service temporarily unavailable',
      details: config.NODE_ENV === 'development' ? error.message : undefined
    })
    return
  }

  // Handle Supabase/Database errors
  if (error.message?.includes('supabase') || error.message?.includes('database')) {
    reply.code(503).send({
      error: 'Database Error',
      message: 'Database service temporarily unavailable',
      details: config.NODE_ENV === 'development' ? error.message : undefined
    })
    return
  }

  // Handle budget/quota errors
  if (error.message?.includes('budget') || error.message?.includes('quota')) {
    reply.code(402).send({
      error: 'Budget Exceeded',
      message: 'AI usage budget exceeded for this tenant',
      details: config.NODE_ENV === 'development' ? error.message : undefined
    })
    return
  }

  // Handle BYOK errors
  if (error.message?.includes('BYOK') || error.message?.includes('API key')) {
    reply.code(401).send({
      error: 'Authentication Error',
      message: 'Invalid API key provided',
      details: config.NODE_ENV === 'development' ? error.message : undefined
    })
    return
  }

  // Handle timeout errors
  if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
    reply.code(504).send({
      error: 'Timeout Error',
      message: 'Request timed out, please try again',
      details: config.NODE_ENV === 'development' ? error.message : undefined
    })
    return
  }

  // Handle generic HTTP errors
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    reply.code(error.statusCode).send({
      error: error.name || 'Client Error',
      message: error.message,
      details: config.NODE_ENV === 'development' ? error.stack : undefined
    })
    return
  }

  // Handle server errors (5xx)
  if (error.statusCode && error.statusCode >= 500) {
    reply.code(error.statusCode).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      details: config.NODE_ENV === 'development' ? error.message : undefined
    })
    return
  }

  // Default error handling
  const statusCode = error.statusCode || 500
  const isServerError = statusCode >= 500

  reply.code(statusCode).send({
    error: isServerError ? 'Internal Server Error' : error.name || 'Error',
    message: isServerError 
      ? 'An unexpected error occurred' 
      : error.message || 'Request failed',
    details: config.NODE_ENV === 'development' ? {
      stack: error.stack,
      code: error.code
    } : undefined,
    timestamp: new Date().toISOString(),
    requestId: request.id
  })
}