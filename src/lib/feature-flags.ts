interface FeatureFlag {
  key: string
  name: string
  description: string
  enabled: boolean
  rollout_percentage?: number
  plans?: string[]
  metadata?: Record<string, any>
}

interface FeatureFlagContext {
  tenantId?: string
  userId?: string
  plan?: string
  userEmail?: string
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    key: 'execution_packs',
    name: 'Execution Packs Add-ons',
    description: 'Allow users to purchase additional execution packs',
    enabled: true,
    plans: ['starter', 'pro']
  },
  {
    key: 'overage_billing',
    name: 'Overage Billing',
    description: 'Charge for executions beyond plan limits',
    enabled: true,
    plans: ['starter', 'pro']
  },
  {
    key: 'auto_upgrade',
    name: 'Auto Upgrade',
    description: 'Automatically upgrade users when they hit limits',
    enabled: false,
    rollout_percentage: 25
  },
  {
    key: 'whatsapp_notifications',
    name: 'WhatsApp Notifications',
    description: 'Send billing notifications via WhatsApp',
    enabled: false,
    rollout_percentage: 10
  },
  {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Enhanced usage and performance analytics',
    enabled: true,
    plans: ['pro', 'enterprise']
  },
  {
    key: 'custom_webhooks',
    name: 'Custom Webhooks',
    description: 'Allow custom webhook endpoints for billing events',
    enabled: false,
    plans: ['enterprise']
  },
  {
    key: 'sso_integration',
    name: 'SSO Integration',
    description: 'Single Sign-On authentication',
    enabled: true,
    plans: ['enterprise']
  }
]

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map()
  
  constructor() {
    this.initializeFlags()
  }

  private initializeFlags() {
    // In production, these would come from database or external service
    DEFAULT_FLAGS.forEach(flag => {
      this.flags.set(flag.key, flag)
    })
  }

  async isEnabled(flagKey: string, context?: FeatureFlagContext): Promise<boolean> {
    const flag = this.flags.get(flagKey)
    if (!flag) return false

    // Check if globally disabled
    if (!flag.enabled) return false

    // Check plan restrictions
    if (flag.plans && context?.plan) {
      if (!flag.plans.includes(context.plan)) return false
    }

    // Check rollout percentage
    if (flag.rollout_percentage !== undefined) {
      return this.isInRollout(flagKey, context, flag.rollout_percentage)
    }

    return true
  }

  private isInRollout(flagKey: string, context: FeatureFlagContext | undefined, percentage: number): boolean {
    if (!context?.userId && !context?.tenantId) {
      return Math.random() * 100 < percentage
    }

    // Use deterministic rollout based on user/tenant ID
    const id = context.userId || context.tenantId || ''
    const hash = this.simpleHash(flagKey + id)
    return (hash % 100) < percentage
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  async getEnabledFlags(context?: FeatureFlagContext): Promise<string[]> {
    const enabled = []
    
    for (const [key, flag] of this.flags) {
      if (await this.isEnabled(key, context)) {
        enabled.push(key)
      }
    }
    
    return enabled
  }

  async getFlagDetails(flagKey: string): Promise<FeatureFlag | null> {
    return this.flags.get(flagKey) || null
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values())
  }

  // Admin functions for managing flags
  async updateFlag(flagKey: string, updates: Partial<FeatureFlag>): Promise<boolean> {
    const flag = this.flags.get(flagKey)
    if (!flag) return false

    const updatedFlag = { ...flag, ...updates }
    this.flags.set(flagKey, updatedFlag)
    
    // In production, persist to database
    return true
  }

  async createFlag(flag: FeatureFlag): Promise<boolean> {
    if (this.flags.has(flag.key)) return false
    
    this.flags.set(flag.key, flag)
    // In production, persist to database
    return true
  }

  async deleteFlag(flagKey: string): Promise<boolean> {
    const deleted = this.flags.delete(flagKey)
    // In production, remove from database
    return deleted
  }
}

// Singleton instance
const featureFlagService = new FeatureFlagService()

// React hook for client-side usage
import { useState, useEffect } from 'react'

export function useFeatureFlag(flagKey: string, context?: FeatureFlagContext) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    featureFlagService.isEnabled(flagKey, context)
      .then(enabled => {
        setIsEnabled(enabled)
        setLoading(false)
      })
      .catch(() => {
        setIsEnabled(false)
        setLoading(false)
      })
  }, [flagKey, context])

  return { isEnabled, loading }
}

export function useFeatureFlags(context?: FeatureFlagContext) {
  const [enabledFlags, setEnabledFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    featureFlagService.getEnabledFlags(context)
      .then(flags => {
        setEnabledFlags(flags)
        setLoading(false)
      })
      .catch(() => {
        setEnabledFlags([])
        setLoading(false)
      })
  }, [context])

  return { enabledFlags, loading }
}

export { featureFlagService, type FeatureFlag, type FeatureFlagContext }