import crypto from 'crypto'
import { config } from './config'
import { logger } from './logger'

interface RedactionResult {
  redactedText: string
  redactionMap: Record<string, string>
  foundPatterns: string[]
}

interface RedactionPattern {
  name: string
  regex: RegExp
  replacement: string
  flags?: string[]
}

class PIIRedactor {
  private patterns: RedactionPattern[]
  private tokenCounter = 0

  constructor() {
    this.patterns = this.initializePatterns()
  }

  private initializePatterns(): RedactionPattern[] {
    return [
      // Email addresses
      {
        name: 'email',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: this.generateToken('EMAIL'),
        flags: ['sensitive']
      },

      // Phone numbers (international format)
      {
        name: 'phone_international',
        regex: /\+\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g,
        replacement: this.generateToken('PHONE'),
        flags: ['sensitive']
      },

      // Phone numbers (US format)
      {
        name: 'phone_us',
        regex: /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g,
        replacement: this.generateToken('PHONE'),
        flags: ['sensitive']
      },

      // Credit card numbers (16 digits)
      {
        name: 'credit_card',
        regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
        replacement: this.generateToken('CREDIT_CARD'),
        flags: ['sensitive', 'financial']
      },

      // Social Security Numbers (US)
      {
        name: 'ssn_us',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: this.generateToken('SSN'),
        flags: ['sensitive', 'government_id']
      },

      // RFC (Mexico tax ID)
      {
        name: 'rfc_mexico',
        regex: /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g,
        replacement: this.generateToken('RFC'),
        flags: ['sensitive', 'government_id']
      },

      // CURP (Mexico citizen ID)
      {
        name: 'curp_mexico',
        regex: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d\b/g,
        replacement: this.generateToken('CURP'),
        flags: ['sensitive', 'government_id']
      },

      // IP addresses (IPv4)
      {
        name: 'ipv4',
        regex: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        replacement: this.generateToken('IP_ADDRESS'),
        flags: ['technical']
      },

      // URLs with sensitive paths
      {
        name: 'sensitive_url',
        regex: /https?:\/\/[^\s]+(?:token|key|secret|password|auth)[^\s]*/gi,
        replacement: this.generateToken('SENSITIVE_URL'),
        flags: ['sensitive', 'credential']
      },

      // API Keys (common patterns)
      {
        name: 'api_key',
        regex: /\b(?:sk-|pk_|api_key_)[a-zA-Z0-9]{20,}\b/g,
        replacement: this.generateToken('API_KEY'),
        flags: ['sensitive', 'credential']
      },

      // JWT tokens
      {
        name: 'jwt_token',
        regex: /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
        replacement: this.generateToken('JWT_TOKEN'),
        flags: ['sensitive', 'credential']
      },

      // Database connection strings
      {
        name: 'db_connection',
        regex: /(?:mongodb|mysql|postgresql|postgres):\/\/[^\s]+/gi,
        replacement: this.generateToken('DB_CONNECTION'),
        flags: ['sensitive', 'credential']
      },

      // Names (common patterns - less aggressive)
      {
        name: 'full_name',
        regex: /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
        replacement: this.generateToken('NAME'),
        flags: ['name']
      },

      // Addresses (basic pattern)
      {
        name: 'address',
        regex: /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Circle|Cir|Court|Ct)\b/gi,
        replacement: this.generateToken('ADDRESS'),
        flags: ['location']
      }
    ]
  }

  /**
   * Redact PII from text
   */
  redact(text: string, options: {
    aggressive?: boolean
    preserveStructure?: boolean
    excludePatterns?: string[]
  } = {}): RedactionResult {
    if (!config.REDACT_PII) {
      return {
        redactedText: text,
        redactionMap: {},
        foundPatterns: []
      }
    }

    let redactedText = text
    const redactionMap: Record<string, string> = {}
    const foundPatterns: string[] = []

    // Apply patterns based on aggressiveness
    const patternsToApply = this.patterns.filter(pattern => {
      if (options.excludePatterns?.includes(pattern.name)) {
        return false
      }

      if (!options.aggressive && pattern.flags?.includes('name')) {
        return false
      }

      return true
    })

    for (const pattern of patternsToApply) {
      const matches = text.match(pattern.regex)
      
      if (matches) {
        foundPatterns.push(pattern.name)
        
        for (const match of matches) {
          const token = this.generateUniqueToken(pattern.name)
          redactionMap[token] = match
          redactedText = redactedText.replace(new RegExp(this.escapeRegex(match), 'g'), token)
        }

        logger.debug({
          pattern: pattern.name,
          matchCount: matches.length
        }, 'PII pattern matched')
      }
    }

    // Additional structure preservation
    if (options.preserveStructure) {
      redactedText = this.preserveJSONStructure(redactedText)
    }

    if (foundPatterns.length > 0) {
      logger.info({
        foundPatterns,
        redactionCount: Object.keys(redactionMap).length
      }, 'PII redacted from text')
    }

    return {
      redactedText,
      redactionMap,
      foundPatterns
    }
  }

  /**
   * Unredact text using redaction map
   */
  unredact(redactedText: string, redactionMap: Record<string, string>): string {
    let unredactedText = redactedText

    for (const [token, originalValue] of Object.entries(redactionMap)) {
      unredactedText = unredactedText.replace(new RegExp(this.escapeRegex(token), 'g'), originalValue)
    }

    return unredactedText
  }

  /**
   * Check if text contains PII
   */
  containsPII(text: string): boolean {
    for (const pattern of this.patterns) {
      if (pattern.regex.test(text)) {
        return true
      }
    }
    return false
  }

  /**
   * Get PII statistics from text
   */
  analyzePII(text: string): {
    hasPII: boolean
    patterns: Array<{
      name: string
      count: number
      flags: string[]
    }>
    riskLevel: 'low' | 'medium' | 'high'
  } {
    const patterns: Array<{ name: string; count: number; flags: string[] }> = []
    let totalMatches = 0
    let hasSensitive = false

    for (const pattern of this.patterns) {
      const matches = text.match(pattern.regex)
      if (matches) {
        patterns.push({
          name: pattern.name,
          count: matches.length,
          flags: pattern.flags || []
        })
        totalMatches += matches.length

        if (pattern.flags?.includes('sensitive')) {
          hasSensitive = true
        }
      }
    }

    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (hasSensitive || totalMatches > 5) {
      riskLevel = 'high'
    } else if (totalMatches > 2) {
      riskLevel = 'medium'
    }

    return {
      hasPII: patterns.length > 0,
      patterns,
      riskLevel
    }
  }

  /**
   * Generate pseudonymized data for testing
   */
  generateTestData(pattern: string): string {
    const generators: Record<string, () => string> = {
      email: () => `test${Math.random().toString(36).substr(2, 5)}@example.com`,
      phone: () => `+1-555-${Math.random().toString().substr(2, 3)}-${Math.random().toString().substr(2, 4)}`,
      credit_card: () => `4111-1111-1111-${Math.random().toString().substr(2, 4)}`,
      ssn: () => `555-55-${Math.random().toString().substr(2, 4)}`,
      name: () => `Test User ${Math.random().toString(36).substr(2, 5)}`,
      address: () => `123 Test St, Test City, TC 12345`,
      api_key: () => `test_${crypto.randomBytes(16).toString('hex')}`,
      ip_address: () => `192.168.1.${Math.floor(Math.random() * 254) + 1}`
    }

    const generator = generators[pattern]
    return generator ? generator() : `TEST_${pattern.toUpperCase()}_${Date.now()}`
  }

  private generateToken(type: string): string {
    return `[${config.PII_REPLACEMENT_TOKEN}_${type}]`
  }

  private generateUniqueToken(type: string): string {
    this.tokenCounter++
    return `[${config.PII_REPLACEMENT_TOKEN}_${type}_${this.tokenCounter}]`
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private preserveJSONStructure(text: string): string {
    // Try to preserve JSON structure by not redacting keys
    try {
      const jsonMatch = text.match(/\{.*\}/s)
      if (jsonMatch) {
        // Simple preservation - avoid redacting JSON keys
        return text.replace(/"([^"]+)":\s*"([^"]*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}[^"]*)"/g, 
          (match, key, value) => {
            const redacted = this.redact(value, { preserveStructure: false })
            return `"${key}": "${redacted.redactedText}"`
          })
      }
    } catch (error) {
      // If not valid JSON, return as-is
    }
    
    return text
  }

  /**
   * Validate redaction configuration
   */
  validateConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    if (this.patterns.length === 0) {
      issues.push('No redaction patterns configured')
    }

    // Test each pattern
    for (const pattern of this.patterns) {
      try {
        'test'.match(pattern.regex)
      } catch (error) {
        issues.push(`Invalid regex for pattern ${pattern.name}: ${error}`)
      }
    }

    if (!config.PII_REPLACEMENT_TOKEN) {
      issues.push('PII replacement token not configured')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

// Export singleton instance
export const piiRedactor = new PIIRedactor()

// Convenience functions
export function redactPII(text: string, options?: any): RedactionResult {
  return piiRedactor.redact(text, options)
}

export function containsPII(text: string): boolean {
  return piiRedactor.containsPII(text)
}

export function analyzePII(text: string) {
  return piiRedactor.analyzePII(text)
}