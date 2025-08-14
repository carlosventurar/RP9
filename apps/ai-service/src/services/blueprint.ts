import { logger, logError } from '@/utils/logger'
import { ContentValidator } from '@/utils/validators'
import type { Blueprint, GeneratedWorkflow, WorkflowNode, WorkflowConnection } from '@/types'

interface ConnectorConfig {
  type: string
  defaultParams: Record<string, any>
  requiredCredentials?: string[]
  endpoints?: Record<string, any>
}

export class BlueprintTranslator {
  private connectors: Map<string, ConnectorConfig>
  private nodeCounter = 0

  constructor() {
    this.connectors = this.initializeConnectors()
  }

  private initializeConnectors(): Map<string, ConnectorConfig> {
    const connectors = new Map<string, ConnectorConfig>()

    // HTTP Request connector
    connectors.set('http', {
      type: 'n8n-nodes-base.httpRequest',
      defaultParams: {
        url: '',
        method: 'GET',
        options: {}
      }
    })

    // HubSpot connector
    connectors.set('hubspot', {
      type: 'n8n-nodes-base.hubspot',
      defaultParams: {
        resource: 'contact',
        operation: 'get'
      },
      requiredCredentials: ['hubspotApi'],
      endpoints: {
        contact: ['create', 'update', 'get', 'getAll', 'delete'],
        company: ['create', 'update', 'get', 'getAll', 'delete'],
        deal: ['create', 'update', 'get', 'getAll', 'delete']
      }
    })

    // Google Sheets connector
    connectors.set('sheets', {
      type: 'n8n-nodes-base.googleSheets',
      defaultParams: {
        operation: 'append',
        resource: 'spreadsheet'
      },
      requiredCredentials: ['googleSheetsOAuth2Api'],
      endpoints: {
        spreadsheet: ['append', 'read', 'update', 'clear'],
        sheet: ['create', 'delete', 'get']
      }
    })

    // WhatsApp Business connector
    connectors.set('whatsapp', {
      type: 'n8n-nodes-base.whatsapp',
      defaultParams: {
        resource: 'message',
        operation: 'send'
      },
      requiredCredentials: ['whatsappApi'],
      endpoints: {
        message: ['send', 'sendLocation', 'sendMedia']
      }
    })

    // Email connector
    connectors.set('email', {
      type: 'n8n-nodes-base.emailSend',
      defaultParams: {
        toEmail: '',
        subject: '',
        text: ''
      },
      requiredCredentials: ['smtp']
    })

    // Slack connector
    connectors.set('slack', {
      type: 'n8n-nodes-base.slack',
      defaultParams: {
        resource: 'message',
        operation: 'post'
      },
      requiredCredentials: ['slackApi'],
      endpoints: {
        message: ['post', 'update', 'delete'],
        channel: ['create', 'get', 'getAll']
      }
    })

    // Webhook trigger
    connectors.set('webhook', {
      type: 'n8n-nodes-base.webhook',
      defaultParams: {
        httpMethod: 'POST',
        path: '',
        responseMode: 'responseNode'
      }
    })

    // Manual trigger
    connectors.set('manual', {
      type: 'n8n-nodes-base.manualTrigger',
      defaultParams: {}
    })

    // Cron trigger
    connectors.set('cron', {
      type: 'n8n-nodes-base.cron',
      defaultParams: {
        triggerTimes: {
          item: [
            {
              mode: 'everyMinute'
            }
          ]
        }
      }
    })

    // IF condition
    connectors.set('if', {
      type: 'n8n-nodes-base.if',
      defaultParams: {
        conditions: {
          boolean: [
            {
              leftValue: '',
              operation: 'equal',
              rightValue: ''
            }
          ]
        }
      }
    })

    // Set node (for data transformation)
    connectors.set('set', {
      type: 'n8n-nodes-base.set',
      defaultParams: {
        values: {
          string: []
        }
      }
    })

    return connectors
  }

  /**
   * Parse natural language prompt to Blueprint DSL
   */
  parsePromptToBlueprint(prompt: string): Blueprint {
    const normalized = prompt.toLowerCase().trim()
    
    // Extract source (trigger)
    const source = this.extractSource(normalized)
    
    // Extract transformations
    const transforms = this.extractTransforms(normalized)
    
    // Extract destinations
    const destinations = this.extractDestinations(normalized)
    
    // Generate metadata
    const metadata = this.generateMetadata(prompt, source, transforms, destinations)

    return {
      source,
      transforms,
      destinations,
      metadata
    }
  }

  private extractSource(prompt: string): Blueprint['source'] {
    // Webhook patterns
    if (prompt.includes('webhook') || prompt.includes('api call') || prompt.includes('http request')) {
      return {
        type: 'webhook',
        config: {
          httpMethod: 'POST',
          path: this.generateWebhookPath(prompt),
          responseMode: 'responseNode'
        }
      }
    }

    // Cron/schedule patterns
    if (prompt.includes('every') || prompt.includes('daily') || prompt.includes('schedule')) {
      return {
        type: 'cron',
        config: {
          triggerTimes: this.extractSchedule(prompt)
        }
      }
    }

    // Manual trigger (default)
    return {
      type: 'manual',
      config: {}
    }
  }

  private extractTransforms(prompt: string): Blueprint['transforms'] {
    const transforms: Blueprint['transforms'] = []

    // Filter conditions
    if (prompt.includes('if') || prompt.includes('when') || prompt.includes('only')) {
      transforms.push({
        type: 'filter',
        config: {
          condition: this.extractCondition(prompt)
        }
      })
    }

    // Data mapping
    if (prompt.includes('map') || prompt.includes('transform') || prompt.includes('convert')) {
      transforms.push({
        type: 'map',
        config: {
          mappings: this.extractMappings(prompt)
        }
      })
    }

    // Split operations
    if (prompt.includes('split') || prompt.includes('each') || prompt.includes('loop')) {
      transforms.push({
        type: 'split',
        config: {
          fieldName: this.extractSplitField(prompt)
        }
      })
    }

    return transforms
  }

  private extractDestinations(prompt: string): Blueprint['destinations'] {
    const destinations: Blueprint['destinations'] = []

    // Email
    if (prompt.includes('email') || prompt.includes('send email')) {
      destinations.push({
        type: 'email',
        config: {
          to: this.extractEmailRecipients(prompt),
          subject: this.extractEmailSubject(prompt),
          body: this.extractEmailBody(prompt)
        }
      })
    }

    // HubSpot
    if (prompt.includes('hubspot') || prompt.includes('crm')) {
      destinations.push({
        type: 'http',
        config: {
          service: 'hubspot',
          operation: this.extractHubSpotOperation(prompt),
          resource: this.extractHubSpotResource(prompt)
        }
      })
    }

    // Google Sheets
    if (prompt.includes('sheets') || prompt.includes('spreadsheet') || prompt.includes('google sheets')) {
      destinations.push({
        type: 'http',
        config: {
          service: 'sheets',
          operation: this.extractSheetsOperation(prompt),
          spreadsheetId: 'SPREADSHEET_ID_HERE'
        }
      })
    }

    // WhatsApp
    if (prompt.includes('whatsapp') || prompt.includes('wa')) {
      destinations.push({
        type: 'http',
        config: {
          service: 'whatsapp',
          operation: 'send',
          phoneNumber: this.extractPhoneNumber(prompt),
          message: this.extractWhatsAppMessage(prompt)
        }
      })
    }

    // Slack
    if (prompt.includes('slack')) {
      destinations.push({
        type: 'http',
        config: {
          service: 'slack',
          operation: 'post',
          channel: this.extractSlackChannel(prompt),
          message: this.extractSlackMessage(prompt)
        }
      })
    }

    // Default HTTP if no specific service detected
    if (destinations.length === 0) {
      destinations.push({
        type: 'http',
        config: {
          method: 'POST',
          url: 'https://api.example.com/webhook',
          headers: {},
          body: '{}'
        }
      })
    }

    return destinations
  }

  /**
   * Translate Blueprint to n8n JSON workflow
   */
  translateToN8nJSON(blueprint: Blueprint): GeneratedWorkflow {
    this.nodeCounter = 0
    const nodes: WorkflowNode[] = []
    const connections: WorkflowConnection[] = []

    // Create source node (trigger)
    const sourceNode = this.createSourceNode(blueprint.source)
    nodes.push(sourceNode)

    let lastNodeId = sourceNode.id
    let yPosition = 300

    // Create transform nodes
    for (const transform of blueprint.transforms) {
      const transformNode = this.createTransformNode(transform, yPosition)
      nodes.push(transformNode)
      
      // Connect to previous node
      connections.push({
        node: transformNode.id,
        type: 'main',
        index: 0
      })

      lastNodeId = transformNode.id
      yPosition += 200
    }

    // Create destination nodes
    for (const [index, destination] of blueprint.destinations.entries()) {
      const destNode = this.createDestinationNode(destination, yPosition)
      nodes.push(destNode)
      
      // Connect to last transform or source
      connections.push({
        node: destNode.id,
        type: 'main',
        index: 0
      })

      yPosition += 200
    }

    // Validate the generated workflow
    const validation = ContentValidator.validateWorkflowJSON({ nodes, connections })
    if (!validation.valid) {
      logger.warn({
        errors: validation.errors,
        warnings: validation.warnings
      }, 'Generated workflow has validation issues')
    }

    return {
      name: blueprint.metadata.name,
      description: blueprint.metadata.description,
      nodes,
      connections,
      metadata: {
        category: this.determineCategory(blueprint),
        difficulty: this.determineDifficulty(blueprint),
        estimatedExecutionTime: this.estimateExecutionTime(blueprint),
        requiredCredentials: this.extractRequiredCredentials(blueprint),
        setupInstructions: this.generateSetupInstructions(blueprint)
      }
    }
  }

  private createSourceNode(source: Blueprint['source']): WorkflowNode {
    const connector = this.connectors.get(source.type)
    if (!connector) {
      throw new Error(`Unknown source type: ${source.type}`)
    }

    return {
      id: this.generateNodeId(),
      name: this.generateNodeName(source.type),
      type: connector.type,
      position: [200, 300],
      parameters: {
        ...connector.defaultParams,
        ...source.config
      }
    }
  }

  private createTransformNode(transform: Blueprint['transforms'][0], yPosition: number): WorkflowNode {
    let nodeType: string
    let parameters: Record<string, any> = {}

    switch (transform.type) {
      case 'filter':
        nodeType = 'n8n-nodes-base.if'
        parameters = {
          conditions: {
            boolean: [
              {
                leftValue: transform.config.condition || '',
                operation: 'equal',
                rightValue: 'true'
              }
            ]
          }
        }
        break

      case 'map':
        nodeType = 'n8n-nodes-base.set'
        parameters = {
          values: {
            string: transform.config.mappings || []
          }
        }
        break

      case 'split':
        nodeType = 'n8n-nodes-base.splitInBatches'
        parameters = {
          options: {
            batchSize: 1
          }
        }
        break

      default:
        nodeType = 'n8n-nodes-base.set'
        parameters = { values: { string: [] } }
    }

    return {
      id: this.generateNodeId(),
      name: this.generateNodeName(transform.type),
      type: nodeType,
      position: [400, yPosition],
      parameters
    }
  }

  private createDestinationNode(destination: Blueprint['destinations'][0], yPosition: number): WorkflowNode {
    const config = destination.config
    let nodeType: string
    let parameters: Record<string, any> = {}
    let credentials: Record<string, string> = {}

    switch (destination.type) {
      case 'email':
        nodeType = 'n8n-nodes-base.emailSend'
        parameters = {
          toEmail: config.to || '',
          subject: config.subject || '',
          text: config.body || ''
        }
        credentials = { smtp: 'smtp' }
        break

      case 'http':
        if (config.service) {
          const connector = this.connectors.get(config.service)
          if (connector) {
            nodeType = connector.type
            parameters = {
              ...connector.defaultParams,
              ...config
            }
            
            if (connector.requiredCredentials) {
              connector.requiredCredentials.forEach(cred => {
                credentials[cred] = cred
              })
            }
          } else {
            nodeType = 'n8n-nodes-base.httpRequest'
            parameters = config
          }
        } else {
          nodeType = 'n8n-nodes-base.httpRequest'
          parameters = config
        }
        break

      default:
        nodeType = 'n8n-nodes-base.httpRequest'
        parameters = config
    }

    const node: WorkflowNode = {
      id: this.generateNodeId(),
      name: this.generateNodeName(destination.type),
      type: nodeType,
      position: [600, yPosition],
      parameters
    }

    if (Object.keys(credentials).length > 0) {
      node.credentials = credentials
    }

    return node
  }

  // Helper methods for extraction
  private generateMetadata(prompt: string, source: any, transforms: any[], destinations: any[]): Blueprint['metadata'] {
    return {
      name: this.extractWorkflowName(prompt),
      description: this.extractWorkflowDescription(prompt),
      tags: this.extractTags(prompt, source, transforms, destinations)
    }
  }

  private extractWorkflowName(prompt: string): string {
    // Try to extract a name from the prompt
    const sentences = prompt.split('.')[0]
    const words = sentences.split(' ').slice(0, 6).join(' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
  }

  private extractWorkflowDescription(prompt: string): string {
    return prompt.length > 100 ? prompt.substring(0, 97) + '...' : prompt
  }

  private extractTags(prompt: string, source: any, transforms: any[], destinations: any[]): string[] {
    const tags = ['ai-generated']
    
    if (source.type === 'webhook') tags.push('webhook')
    if (source.type === 'cron') tags.push('scheduled')
    if (transforms.some((t: any) => t.type === 'filter')) tags.push('conditional')
    if (destinations.some((d: any) => d.type === 'email')) tags.push('email')
    
    return tags
  }

  private generateNodeId(): string {
    return `node_${++this.nodeCounter}`
  }

  private generateNodeName(type: string): string {
    const names = {
      webhook: 'Webhook Trigger',
      manual: 'Manual Trigger',
      cron: 'Schedule Trigger',
      filter: 'Filter',
      map: 'Transform Data',
      split: 'Split Items',
      email: 'Send Email',
      http: 'HTTP Request'
    }
    
    return names[type as keyof typeof names] || type.charAt(0).toUpperCase() + type.slice(1)
  }

  // Extraction helper methods (simplified implementations)
  private generateWebhookPath(prompt: string): string {
    return '/webhook-' + Math.random().toString(36).substr(2, 9)
  }

  private extractSchedule(prompt: string): any {
    if (prompt.includes('daily')) {
      return { item: [{ mode: 'everyDay', hour: 9 }] }
    }
    if (prompt.includes('hourly')) {
      return { item: [{ mode: 'everyHour' }] }
    }
    return { item: [{ mode: 'everyMinute' }] }
  }

  private extractCondition(prompt: string): string {
    // Simplified condition extraction
    return '{{ $json.status === "active" }}'
  }

  private extractMappings(prompt: string): any[] {
    return [
      {
        name: 'processed_data',
        value: '{{ $json }}'
      }
    ]
  }

  private extractSplitField(prompt: string): string {
    return 'items'
  }

  private extractEmailRecipients(prompt: string): string {
    return '{{ $json.email || "user@example.com" }}'
  }

  private extractEmailSubject(prompt: string): string {
    return 'Notification from RP9 Workflow'
  }

  private extractEmailBody(prompt: string): string {
    return 'Your workflow has been executed successfully.'
  }

  private extractHubSpotOperation(prompt: string): string {
    if (prompt.includes('create')) return 'create'
    if (prompt.includes('update')) return 'update'
    return 'create'
  }

  private extractHubSpotResource(prompt: string): string {
    if (prompt.includes('contact')) return 'contact'
    if (prompt.includes('company')) return 'company'
    if (prompt.includes('deal')) return 'deal'
    return 'contact'
  }

  private extractSheetsOperation(prompt: string): string {
    if (prompt.includes('read')) return 'read'
    if (prompt.includes('update')) return 'update'
    return 'append'
  }

  private extractPhoneNumber(prompt: string): string {
    return '{{ $json.phone || "+1234567890" }}'
  }

  private extractWhatsAppMessage(prompt: string): string {
    return 'Message from RP9 Workflow'
  }

  private extractSlackChannel(prompt: string): string {
    return '#general'
  }

  private extractSlackMessage(prompt: string): string {
    return 'Notification from RP9 Workflow'
  }

  private determineCategory(blueprint: Blueprint): string {
    if (blueprint.destinations.some(d => d.type === 'email')) return 'communication'
    if (blueprint.destinations.some(d => d.config.service === 'hubspot')) return 'crm'
    if (blueprint.destinations.some(d => d.config.service === 'sheets')) return 'data'
    return 'automation'
  }

  private determineDifficulty(blueprint: Blueprint): 'beginner' | 'intermediate' | 'advanced' {
    const complexity = blueprint.transforms.length + blueprint.destinations.length
    if (complexity <= 2) return 'beginner'
    if (complexity <= 4) return 'intermediate'
    return 'advanced'
  }

  private estimateExecutionTime(blueprint: Blueprint): number {
    // Base time + time per transform + time per destination
    let time = 1000 // 1 second base
    time += blueprint.transforms.length * 500 // 0.5s per transform
    time += blueprint.destinations.length * 1000 // 1s per destination
    return time
  }

  private extractRequiredCredentials(blueprint: Blueprint): string[] {
    const credentials = new Set<string>()
    
    blueprint.destinations.forEach(dest => {
      if (dest.config.service) {
        const connector = this.connectors.get(dest.config.service)
        if (connector?.requiredCredentials) {
          connector.requiredCredentials.forEach(cred => credentials.add(cred))
        }
      }
    })
    
    return Array.from(credentials)
  }

  private generateSetupInstructions(blueprint: Blueprint): string[] {
    const instructions = ['1. Import this workflow into your n8n instance']
    
    const credentials = this.extractRequiredCredentials(blueprint)
    if (credentials.length > 0) {
      instructions.push(`2. Configure credentials: ${credentials.join(', ')}`)
    }
    
    if (blueprint.source.type === 'webhook') {
      instructions.push('3. Copy the webhook URL and configure your external system')
    }
    
    instructions.push('4. Test the workflow with sample data')
    instructions.push('5. Activate the workflow when ready')
    
    return instructions
  }
}

// Export singleton instance
export const blueprintTranslator = new BlueprintTranslator()