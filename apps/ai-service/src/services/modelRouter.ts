import { config } from '@/utils/config'
import { logger, logAIRequest, logError } from '@/utils/logger'
import { aiCache } from './cache'
import type { AIProvider, AIRequest, AIResponse, ChatMessage } from '@/types'

interface ProviderConfig {
  name: string
  apiKey: string
  baseUrl: string
  models: {
    primary: string
    fallback?: string
  }
}

export class ModelRouter {
  private providers: Map<string, ProviderConfig> = new Map()

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    // Initialize OpenAI provider
    if (config.ENABLED_PROVIDERS.includes('openai') && config.OPENAI_API_KEY) {
      this.providers.set('openai', {
        name: 'openai',
        apiKey: config.OPENAI_API_KEY,
        baseUrl: 'https://api.openai.com/v1',
        models: {
          primary: config.AI_MODEL_PRIMARY,
          fallback: 'gpt-3.5-turbo'
        }
      })
      logger.info('OpenAI provider initialized')
    }

    // Initialize Anthropic provider
    if (config.ENABLED_PROVIDERS.includes('anthropic') && config.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', {
        name: 'anthropic',
        apiKey: config.ANTHROPIC_API_KEY,
        baseUrl: 'https://api.anthropic.com/v1',
        models: {
          primary: config.AI_MODEL_FALLBACK,
          fallback: 'claude-3-haiku-20240307'
        }
      })
      logger.info('Anthropic provider initialized')
    }

    if (this.providers.size === 0) {
      logger.warn('No AI providers configured')
    } else {
      logger.info(`Initialized ${this.providers.size} AI providers: ${Array.from(this.providers.keys()).join(', ')}`)
    }
  }

  /**
   * Route AI request to appropriate provider with fallback
   */
  async routeRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request)
    const cached = aiCache.get(request.tenantId, cacheKey, request.context)
    
    if (cached) {
      return {
        ...cached,
        cached: true,
        latency: Date.now() - startTime
      }
    }

    // Determine provider priority
    const providers = this.selectProviders(request)
    
    if (providers.length === 0) {
      throw new Error('No AI providers available')
    }

    let lastError: Error | null = null

    // Try providers in order
    for (const provider of providers) {
      try {
        const response = await this.callProvider(provider, request)
        const latency = Date.now() - startTime

        // Log successful request
        logAIRequest({
          tenantId: request.tenantId,
          userId: request.userId,
          provider: provider.name,
          action: this.detectAction(request.messages),
          tokens: response.tokens,
          cost: response.cost,
          latency,
          cached: false
        })

        // Cache the response
        aiCache.set(request.tenantId, cacheKey, response, request.context)

        return {
          ...response,
          latency,
          cached: false
        }

      } catch (error: any) {
        lastError = error
        logError(error, {
          provider: provider.name,
          tenantId: request.tenantId,
          userId: request.userId
        })

        // If this is a BYOK error, don't try fallback
        if (provider.name.startsWith('byok:')) {
          throw error
        }

        // Continue to next provider for fallback
        logger.warn(`Provider ${provider.name} failed, trying fallback`)
        continue
      }
    }

    // All providers failed
    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`)
  }

  /**
   * Select providers based on request preferences and availability
   */
  private selectProviders(request: AIRequest): ProviderConfig[] {
    const providers: ProviderConfig[] = []

    // BYOK has highest priority
    if (request.byokProvider && request.byokKey) {
      const byokProvider = this.createBYOKProvider(request.byokProvider, request.byokKey)
      providers.push(byokProvider)
      
      logger.info({
        tenantId: request.tenantId,
        provider: request.byokProvider
      }, 'Using BYOK provider')
      
      return providers // BYOK only, no fallback
    }

    // User preference
    if (request.provider && request.provider !== 'auto') {
      const preferred = this.providers.get(request.provider)
      if (preferred) {
        providers.push(preferred)
      }
    }

    // Add remaining providers for fallback
    for (const [name, provider] of this.providers) {
      if (!providers.find(p => p.name === name)) {
        providers.push(provider)
      }
    }

    return providers
  }

  /**
   * Create BYOK provider configuration
   */
  private createBYOKProvider(providerName: string, apiKey: string): ProviderConfig {
    switch (providerName) {
      case 'openai':
        return {
          name: 'byok:openai',
          apiKey,
          baseUrl: 'https://api.openai.com/v1',
          models: {
            primary: config.AI_MODEL_PRIMARY,
            fallback: 'gpt-3.5-turbo'
          }
        }
      
      case 'anthropic':
        return {
          name: 'byok:anthropic',
          apiKey,
          baseUrl: 'https://api.anthropic.com/v1',
          models: {
            primary: config.AI_MODEL_FALLBACK,
            fallback: 'claude-3-haiku-20240307'
          }
        }
      
      default:
        throw new Error(`Unsupported BYOK provider: ${providerName}`)
    }
  }

  /**
   * Call specific AI provider
   */
  private async callProvider(provider: ProviderConfig, request: AIRequest): Promise<Omit<AIResponse, 'latency' | 'cached'>> {
    const isAnthropic = provider.name.includes('anthropic')
    
    if (isAnthropic) {
      return this.callAnthropic(provider, request)
    } else {
      return this.callOpenAI(provider, request)
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(provider: ProviderConfig, request: AIRequest): Promise<Omit<AIResponse, 'latency' | 'cached'>> {
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.models.primary,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error (${response.status}): ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    
    if (!choice) {
      throw new Error('No response from OpenAI')
    }

    const tokens = {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0
    }

    const cost = this.calculateCost('openai', tokens.input + tokens.output)

    return {
      content: choice.message?.content || '',
      provider: provider.name,
      tokens,
      cost
    }
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(provider: ProviderConfig, request: AIRequest): Promise<Omit<AIResponse, 'latency' | 'cached'>> {
    // Convert messages format for Anthropic
    const messages = request.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }))

    const systemMessage = request.messages.find(msg => msg.role === 'system')?.content

    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': provider.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: provider.models.primary,
        max_tokens: 2000,
        temperature: 0.7,
        system: systemMessage,
        messages
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API error (${response.status}): ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''

    const tokens = {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0
    }

    const cost = this.calculateCost('anthropic', tokens.input + tokens.output)

    return {
      content,
      provider: provider.name,
      tokens,
      cost
    }
  }

  /**
   * Calculate cost for API usage
   */
  private calculateCost(provider: string, totalTokens: number): number {
    // Simplified cost calculation - in production, use specific rates per model
    const costPer1k = config.COST_PER_1K_TOKENS_USD
    return (totalTokens / 1000) * costPer1k
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: AIRequest): string {
    const content = request.messages.map(m => `${m.role}:${m.content}`).join('|')
    return content
  }

  /**
   * Detect action type from messages
   */
  private detectAction(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ''
    
    if (lastMessage.includes('generar') || lastMessage.includes('crear')) return 'generate'
    if (lastMessage.includes('error') || lastMessage.includes('debug')) return 'explain'
    if (lastMessage.includes('optimizar') || lastMessage.includes('mejorar')) return 'optimize'
    
    return 'chat'
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(name: string): boolean {
    return this.providers.has(name)
  }

  /**
   * Get provider statistics
   */
  getStats(): Record<string, any> {
    return {
      providers: this.getAvailableProviders(),
      cache: aiCache.getStats(),
      byokEnabled: config.ALLOW_BYOK
    }
  }
}

// Export singleton instance
export const modelRouter = new ModelRouter()