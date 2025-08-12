'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OnboardingTask {
  key: string
  title: string
  description: string
  critical: boolean
  category: string
  order_index: number
  status: 'pending' | 'done' | 'error'
  meta?: any
}

interface ProgressStats {
  total: number
  completed: number
  critical_pending: number
  percentage: number
}

interface OnboardingProgress {
  tasks: OnboardingTask[]
  stats: ProgressStats
  isActivated: boolean
  healthScore: number
  loading: boolean
  error: string | null
}

export function useOnboardingProgress(tenantId?: string) {
  const supabase = createClient()
  const [progress, setProgress] = useState<OnboardingProgress>({
    tasks: [],
    stats: { total: 0, completed: 0, critical_pending: 0, percentage: 0 },
    isActivated: false,
    healthScore: 0,
    loading: true,
    error: null
  })

  const loadProgress = useCallback(async () => {
    if (!tenantId) return

    try {
      setProgress(prev => ({ ...prev, loading: true, error: null }))

      // Get all onboarding tasks
      const { data: allTasks, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .order('order_index')

      if (tasksError) {
        throw new Error(`Error loading tasks: ${tasksError.message}`)
      }

      // Get progress for this tenant
      const { data: progressData, error: progressError } = await supabase
        .from('onboarding_progress')
        .select('task_key, status, meta')
        .eq('tenant_id', tenantId)

      if (progressError) {
        console.warn('Error loading progress:', progressError)
        // Continue with empty progress
      }

      // Merge tasks with progress
      const progressMap = new Map(
        (progressData || []).map(p => [p.task_key, p])
      )

      const tasksWithProgress: OnboardingTask[] = (allTasks || []).map(task => ({
        ...task,
        status: progressMap.get(task.key)?.status || 'pending',
        meta: progressMap.get(task.key)?.meta || {}
      }))

      // Calculate stats
      const total = tasksWithProgress.length
      const completed = tasksWithProgress.filter(t => t.status === 'done').length
      const critical_pending = tasksWithProgress.filter(t => t.status === 'pending' && t.critical).length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

      // Check activation status
      const { data: activationData } = await supabase
        .rpc('is_tenant_activated', { p_tenant_id: tenantId })

      // Get health score
      const { data: healthData } = await supabase
        .rpc('calculate_health_score', { p_tenant_id: tenantId })

      setProgress({
        tasks: tasksWithProgress,
        stats: { total, completed, critical_pending, percentage },
        isActivated: activationData || false,
        healthScore: healthData?.total || 0,
        loading: false,
        error: null
      })

    } catch (error) {
      console.error('Error loading onboarding progress:', error)
      setProgress(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [tenantId, supabase])

  const updateTaskStatus = useCallback(async (
    taskKey: string, 
    status: 'pending' | 'done' | 'error',
    meta?: any
  ) => {
    if (!tenantId) return false

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const response = await fetch('/.netlify/functions/onboarding-save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId: user?.id,
          taskKey,
          status,
          meta
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update task status')
      }

      // Reload progress
      await loadProgress()
      return true

    } catch (error) {
      console.error('Error updating task status:', error)
      return false
    }
  }, [tenantId, loadProgress])

  const completeTask = useCallback((taskKey: string, meta?: any) => {
    return updateTaskStatus(taskKey, 'done', meta)
  }, [updateTaskStatus])

  const markTaskError = useCallback((taskKey: string, error: string) => {
    return updateTaskStatus(taskKey, 'error', { error })
  }, [updateTaskStatus])

  const resetTask = useCallback((taskKey: string) => {
    return updateTaskStatus(taskKey, 'pending')
  }, [updateTaskStatus])

  // Auto-load on mount and tenant change
  useEffect(() => {
    if (tenantId) {
      loadProgress()
    }
  }, [tenantId, loadProgress])

  // Set up real-time subscription for progress updates
  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel('onboarding_progress')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'onboarding_progress',
        filter: `tenant_id=eq.${tenantId}`
      }, () => {
        // Reload progress when changes occur
        loadProgress()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'health_snapshots',
        filter: `tenant_id=eq.${tenantId}`
      }, () => {
        // Reload when health score changes
        loadProgress()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, loadProgress, supabase])

  return {
    ...progress,
    refresh: loadProgress,
    completeTask,
    markTaskError,
    resetTask,
    updateTaskStatus
  }
}

export type { OnboardingTask, ProgressStats, OnboardingProgress }