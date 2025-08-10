'use client'

import { Badge } from '@/components/ui/badge'
import { Crown, Lock, Zap } from 'lucide-react'

interface TemplatePriceBadgeProps {
  price: number
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'default' | 'lg'
}

export function TemplatePriceBadge({ 
  price, 
  className = '', 
  showIcon = true,
  size = 'default'
}: TemplatePriceBadgeProps) {
  const isFree = price <= 0
  const isPro = price > 0 && price <= 15
  const isEnterprise = price > 15

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    default: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  // Icon size classes
  const iconSizeClasses = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5', 
    lg: 'h-4 w-4'
  }

  if (isFree) {
    return (
      <Badge 
        variant="secondary" 
        className={`
          bg-green-500/20 text-green-300 border-green-500/50 
          ${sizeClasses[size]} 
          ${className}
        `}
      >
        {showIcon && <Zap className={`${iconSizeClasses[size]} mr-1`} />}
        FREE
      </Badge>
    )
  }

  if (isPro) {
    return (
      <Badge 
        variant="outline" 
        className={`
          bg-blue-500/20 text-blue-300 border-blue-500/50 
          ${sizeClasses[size]} 
          ${className}
        `}
      >
        {showIcon && <Lock className={`${iconSizeClasses[size]} mr-1`} />}
        ${price}
      </Badge>
    )
  }

  // Enterprise
  return (
    <Badge 
      variant="outline" 
      className={`
        bg-gradient-to-r from-purple-500/20 to-amber-500/20 
        text-amber-300 border-purple-500/50 
        ${sizeClasses[size]} 
        ${className}
      `}
    >
      {showIcon && <Crown className={`${iconSizeClasses[size]} mr-1`} />}
      ${price}
    </Badge>
  )
}

export function getTemplateTier(price: number): 'free' | 'pro' | 'enterprise' {
  if (price <= 0) return 'free'
  if (price <= 15) return 'pro'
  return 'enterprise'
}

export function getTemplateTierInfo(price: number) {
  const tier = getTemplateTier(price)
  
  const tierInfo = {
    free: {
      name: 'Free',
      description: 'Basic automation workflows',
      color: 'green',
      icon: Zap
    },
    pro: {
      name: 'Pro', 
      description: 'Advanced business workflows',
      color: 'blue',
      icon: Lock
    },
    enterprise: {
      name: 'Enterprise',
      description: 'Complex enterprise solutions', 
      color: 'purple',
      icon: Crown
    }
  }
  
  return {
    tier,
    price,
    ...tierInfo[tier]
  }
}