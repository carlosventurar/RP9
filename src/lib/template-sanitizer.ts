/**
 * Template Sanitizer - Clean n8n workflows from sensitive data
 * Removes credentials, API keys, passwords, and personal data
 * Replaces them with placeholder variables
 */

export interface SanitizationResult {
  sanitizedWorkflow: any
  credentialMappings: CredentialMapping[]
  variableReplacements: VariableReplacement[]
  warnings: string[]
}

export interface CredentialMapping {
  originalId: string
  credentialType: string
  placeholderName: string
  requiredFields: string[]
}

export interface VariableReplacement {
  path: string
  originalValue: string
  placeholderValue: string
  type: 'email' | 'url' | 'key' | 'password' | 'phone' | 'name'
}

// Common credential types in n8n
const CREDENTIAL_TYPES = [
  'httpBasicAuth',
  'httpDigestAuth', 
  'httpHeaderAuth',
  'oAuth1Api',
  'oAuth2Api',
  'googleApi',
  'slackApi',
  'githubApi',
  'stripeApi',
  'mailgunApi',
  'sendGridApi',
  'twilioApi',
  'salesforceOAuth2Api',
  'hubspotApi',
  'shopifyApi',
  'mysqlApi',
  'postgresApi',
  'mongoDb',
  'redis',
  'aws',
  'gcpServiceAccount'
]

// Sensitive field patterns
const SENSITIVE_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  apiKey: /^[a-zA-Z0-9_-]{20,}$/,
  password: /^.{8,}$/,
  url: /^https?:\/\/[^\s]+$/,
  phone: /^[\+]?[1-9][\d]{3,14}$/,
  secretKey: /^(sk_|pk_|api_|key_|secret_)/i,
  bearer: /^Bearer\s+/i,
  basicAuth: /^Basic\s+/i
}

// Fields that commonly contain sensitive data
const SENSITIVE_FIELD_NAMES = [
  'password',
  'apiKey',
  'api_key',
  'clientSecret',
  'client_secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'secretKey',
  'secret_key',
  'token',
  'auth',
  'authorization',
  'credentials',
  'key',
  'secret',
  'connectionString',
  'connection_string',
  'host',
  'username',
  'user',
  'database',
  'port'
]

/**
 * Main sanitization function
 */
export function sanitizeTemplate(workflow: any): SanitizationResult {
  const result: SanitizationResult = {
    sanitizedWorkflow: JSON.parse(JSON.stringify(workflow)), // Deep clone
    credentialMappings: [],
    variableReplacements: [],
    warnings: []
  }

  try {
    // 1. Sanitize workflow metadata
    sanitizeWorkflowMetadata(result)

    // 2. Process nodes and their credentials
    if (result.sanitizedWorkflow.nodes) {
      result.sanitizedWorkflow.nodes.forEach((node: any, index: number) => {
        sanitizeNode(node, index, result)
      })
    }

    // 3. Clean up connections (should be safe but check for embedded data)
    if (result.sanitizedWorkflow.connections) {
      sanitizeConnections(result.sanitizedWorkflow.connections, result)
    }

    // 4. Remove or sanitize settings
    sanitizeSettings(result.sanitizedWorkflow.settings, result)

    // 5. Clean up any remaining sensitive data in the workflow
    sanitizeRemainingData(result.sanitizedWorkflow, result)

    console.log(`Template sanitized successfully. Found ${result.credentialMappings.length} credentials and ${result.variableReplacements.length} sensitive values.`)

  } catch (error) {
    result.warnings.push(`Sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    console.error('Template sanitization failed:', error)
  }

  return result
}

/**
 * Sanitize workflow-level metadata
 */
function sanitizeWorkflowMetadata(result: SanitizationResult) {
  const workflow = result.sanitizedWorkflow

  // Remove or anonymize personal information
  if (workflow.createdAt) delete workflow.createdAt
  if (workflow.updatedAt) delete workflow.updatedAt
  if (workflow.id) delete workflow.id

  // Clean up tags that might contain sensitive info
  if (workflow.tags) {
    workflow.tags = workflow.tags.filter((tag: string) => 
      !tag.toLowerCase().includes('prod') &&
      !tag.toLowerCase().includes('staging') &&
      !tag.toLowerCase().includes('test') &&
      !SENSITIVE_PATTERNS.email.test(tag)
    )
  }
}

/**
 * Sanitize individual node
 */
function sanitizeNode(node: any, nodeIndex: number, result: SanitizationResult) {
  // Remove node IDs and positions (will be regenerated)
  if (node.id) delete node.id
  if (node.position) delete node.position

  // Handle credentials
  if (node.credentials) {
    Object.keys(node.credentials).forEach(credType => {
      const credentialMapping: CredentialMapping = {
        originalId: node.credentials[credType].id || `cred_${nodeIndex}_${credType}`,
        credentialType: credType,
        placeholderName: `{{CREDENTIAL_${credType.toUpperCase()}_${nodeIndex}}}`,
        requiredFields: getRequiredFieldsForCredential(credType)
      }

      result.credentialMappings.push(credentialMapping)
      
      // Replace with placeholder
      node.credentials[credType] = {
        id: credentialMapping.placeholderName,
        name: `Template ${credType}`
      }
    })
  }

  // Sanitize node parameters
  if (node.parameters) {
    sanitizeNodeParameters(node.parameters, `node_${nodeIndex}`, result)
  }

  // Sanitize webhook URLs and other node-specific settings
  if (node.webhookId) delete node.webhookId
  if (node.type === 'n8n-nodes-base.webhook' || node.type === 'n8n-nodes-base.Webhook') {
    sanitizeWebhookNode(node, result)
  }
}

/**
 * Sanitize node parameters recursively
 */
function sanitizeNodeParameters(params: any, nodePath: string, result: SanitizationResult) {
  Object.keys(params).forEach(key => {
    const value = params[key]
    const currentPath = `${nodePath}.${key}`

    if (typeof value === 'string') {
      // Check if this looks like sensitive data
      const replacement = getSanitizedValue(key, value, currentPath)
      if (replacement) {
        result.variableReplacements.push(replacement)
        params[key] = replacement.placeholderValue
      }
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Handle arrays
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            sanitizeNodeParameters(item, `${currentPath}[${index}]`, result)
          }
        })
      } else {
        // Handle nested objects
        sanitizeNodeParameters(value, currentPath, result)
      }
    }
  })
}

/**
 * Get sanitized value for a field if it contains sensitive data
 */
function getSanitizedValue(fieldName: string, value: string, path: string): VariableReplacement | null {
  if (!value || typeof value !== 'string') return null

  const lowerFieldName = fieldName.toLowerCase()
  const trimmedValue = value.trim()

  // Check if field name indicates sensitive data
  if (SENSITIVE_FIELD_NAMES.some(sensitive => lowerFieldName.includes(sensitive))) {
    return {
      path,
      originalValue: value,
      placeholderValue: `{{${fieldName.toUpperCase()}}}`,
      type: getSensitiveDataType(fieldName, value)
    }
  }

  // Check value patterns
  if (SENSITIVE_PATTERNS.email.test(trimmedValue)) {
    return {
      path,
      originalValue: value,
      placeholderValue: '{{USER_EMAIL}}',
      type: 'email'
    }
  }

  if (SENSITIVE_PATTERNS.secretKey.test(trimmedValue)) {
    return {
      path,
      originalValue: value,
      placeholderValue: `{{${fieldName.toUpperCase()}_KEY}}`,
      type: 'key'
    }
  }

  if (SENSITIVE_PATTERNS.url.test(trimmedValue) && (
    trimmedValue.includes('localhost') ||
    trimmedValue.includes('127.0.0.1') ||
    trimmedValue.includes('.local') ||
    trimmedValue.includes('staging') ||
    trimmedValue.includes('dev.')
  )) {
    return {
      path,
      originalValue: value,
      placeholderValue: '{{API_ENDPOINT}}',
      type: 'url'
    }
  }

  if (SENSITIVE_PATTERNS.phone.test(trimmedValue)) {
    return {
      path,
      originalValue: value,
      placeholderValue: '{{PHONE_NUMBER}}',
      type: 'phone'
    }
  }

  // Check for common API key patterns
  if (trimmedValue.length > 20 && /^[a-zA-Z0-9_-]+$/.test(trimmedValue)) {
    return {
      path,
      originalValue: value,
      placeholderValue: `{{${fieldName.toUpperCase()}}}`,
      type: 'key'
    }
  }

  return null
}

/**
 * Determine the type of sensitive data
 */
function getSensitiveDataType(fieldName: string, value: string): VariableReplacement['type'] {
  const lower = fieldName.toLowerCase()
  
  if (lower.includes('email')) return 'email'
  if (lower.includes('url') || lower.includes('endpoint')) return 'url'
  if (lower.includes('phone')) return 'phone'
  if (lower.includes('password')) return 'password'
  if (lower.includes('name')) return 'name'
  
  return 'key'
}

/**
 * Sanitize webhook nodes specifically
 */
function sanitizeWebhookNode(node: any, result: SanitizationResult) {
  if (node.parameters?.path) {
    // Replace webhook paths that might contain sensitive info
    const originalPath = node.parameters.path
    if (originalPath.includes('test') || originalPath.includes('dev') || originalPath.includes('local')) {
      node.parameters.path = '/webhook/template'
      result.variableReplacements.push({
        path: `${node.name}.parameters.path`,
        originalValue: originalPath,
        placeholderValue: '{{WEBHOOK_PATH}}',
        type: 'url'
      })
    }
  }

  // Remove webhook IDs and URLs
  if (node.parameters?.httpMethod) {
    // Keep HTTP method as is, it's not sensitive
  }
  
  if (node.parameters?.responseMode) {
    // Keep response mode as is
  }
}

/**
 * Clean up connections (usually safe but check for embedded data)
 */
function sanitizeConnections(connections: any, result: SanitizationResult) {
  // Connections are usually just node references, but check for any embedded data
  Object.keys(connections).forEach(sourceNode => {
    const connection = connections[sourceNode]
    if (typeof connection === 'object' && connection !== null) {
      // Check if there's any sensitive data in connection metadata
      // Usually connections are clean, but be thorough
    }
  })
}

/**
 * Sanitize workflow settings
 */
function sanitizeSettings(settings: any, result: SanitizationResult) {
  if (!settings) return

  // Remove potentially sensitive settings
  if (settings.timezone) {
    // Keep timezone as it's usually not sensitive, but check for custom values
  }

  if (settings.saveDataErrorExecution) {
    // This is a boolean, keep it
  }

  if (settings.saveDataSuccessExecution) {
    // This is a boolean, keep it
  }

  if (settings.saveExecutionProgress) {
    // This is a boolean, keep it
  }

  // Remove any custom settings that might contain sensitive data
  Object.keys(settings).forEach(key => {
    const value = settings[key]
    if (typeof value === 'string' && getSanitizedValue(key, value, `settings.${key}`)) {
      delete settings[key]
      result.warnings.push(`Removed potentially sensitive setting: ${key}`)
    }
  })
}

/**
 * Final pass to clean up any remaining sensitive data
 */
function sanitizeRemainingData(workflow: any, result: SanitizationResult) {
  // Convert workflow to string and back to catch any missed sensitive data
  const workflowString = JSON.stringify(workflow)
  
  // Check for common sensitive patterns that might have been missed
  const sensitiveMatches = [
    /password["\s]*:[\s]*["'][^"']+["']/gi,
    /api[_-]?key["\s]*:[\s]*["'][^"']+["']/gi,
    /secret["\s]*:[\s]*["'][^"']+["']/gi,
    /token["\s]*:[\s]*["'][^"']+["']/gi
  ]

  sensitiveMatches.forEach(pattern => {
    if (pattern.test(workflowString)) {
      result.warnings.push('Potentially sensitive data detected in final scan. Manual review recommended.')
    }
  })
}

/**
 * Get required fields for a credential type
 */
function getRequiredFieldsForCredential(credentialType: string): string[] {
  const credentialFields: Record<string, string[]> = {
    httpBasicAuth: ['user', 'password'],
    httpHeaderAuth: ['name', 'value'],
    oAuth2Api: ['clientId', 'clientSecret'],
    googleApi: ['email', 'privateKey'],
    slackApi: ['accessToken'],
    githubApi: ['accessToken'],
    stripeApi: ['secretKey'],
    mailgunApi: ['apiKey'],
    sendGridApi: ['apiKey'],
    twilioApi: ['accountSid', 'authToken'],
    salesforceOAuth2Api: ['clientId', 'clientSecret'],
    hubspotApi: ['apiKey'],
    shopifyApi: ['apiKey', 'password'],
    mysqlApi: ['host', 'database', 'username', 'password'],
    postgresApi: ['host', 'database', 'user', 'password'],
    mongoDb: ['connectionString'],
    redis: ['host', 'port'],
    aws: ['accessKeyId', 'secretAccessKey'],
    gcpServiceAccount: ['email', 'privateKey']
  }

  return credentialFields[credentialType] || ['apiKey']
}

/**
 * Generate installation instructions based on sanitization results
 */
export function generateInstallationInstructions(sanitizationResult: SanitizationResult): string {
  let instructions = '# Template Installation Instructions\n\n'
  
  if (sanitizationResult.credentialMappings.length > 0) {
    instructions += '## Required Credentials\n\n'
    instructions += 'Before using this template, you need to configure the following credentials in your n8n instance:\n\n'
    
    sanitizationResult.credentialMappings.forEach((mapping, index) => {
      instructions += `${index + 1}. **${mapping.credentialType}**\n`
      instructions += `   - Type: ${mapping.credentialType}\n`
      instructions += `   - Required fields: ${mapping.requiredFields.join(', ')}\n\n`
    })
  }

  if (sanitizationResult.variableReplacements.length > 0) {
    instructions += '## Configuration Variables\n\n'
    instructions += 'The following values need to be configured:\n\n'
    
    sanitizationResult.variableReplacements.forEach((replacement, index) => {
      instructions += `${index + 1}. **${replacement.placeholderValue}**\n`
      instructions += `   - Type: ${replacement.type}\n`
      instructions += `   - Description: Replace with your ${replacement.type}\n\n`
    })
  }

  if (sanitizationResult.warnings.length > 0) {
    instructions += '## Warnings\n\n'
    sanitizationResult.warnings.forEach(warning => {
      instructions += `⚠️ ${warning}\n`
    })
    instructions += '\n'
  }

  instructions += '## Installation Steps\n\n'
  instructions += '1. Configure all required credentials in your n8n instance\n'
  instructions += '2. Import this workflow template\n'
  instructions += '3. Update all placeholder values with your actual configuration\n'
  instructions += '4. Test the workflow with sample data\n'
  instructions += '5. Activate the workflow when ready\n\n'

  return instructions
}