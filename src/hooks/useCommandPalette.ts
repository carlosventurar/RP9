'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface AICommand {
  id: string
  title: string
  description: string
  category: 'ai' | 'workflow' | 'navigation' | 'system'
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string[]
  action: string
  params?: Record<string, any>
  premium?: boolean
}

interface UseCommandPaletteOptions {
  onAIAction?: (action: string, params?: any) => void
  onWorkflowAction?: (action: string, params?: any) => void
}

export function useCommandPalette(options: UseCommandPaletteOptions = {}) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const openPalette = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closePalette = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleCommandSelect = useCallback((command: AICommand) => {
    const [category, action] = command.action.split(':')

    switch (category) {
      case 'ai':
        if (options.onAIAction) {
          options.onAIAction(action, command.params)
        } else {
          // Default AI actions
          switch (action) {
            case 'generate':
              router.push('/ai?mode=generate')
              break
            case 'explain':
              router.push('/ai?mode=debug')
              break
            case 'optimize':
              router.push('/ai?mode=optimize')
              break
            case 'chat':
              router.push('/ai')
              break
            default:
              toast.error('Acción de IA no implementada')
          }
        }
        break

      case 'workflow':
        if (options.onWorkflowAction) {
          options.onWorkflowAction(action, command.params)
        } else {
          // Default workflow actions
          switch (action) {
            case 'new':
              router.push('/workflows/new')
              break
            case 'run':
              toast.info('Ejecutar workflow desde el editor')
              break
            case 'stop':
              toast.info('Detener workflow desde el editor')
              break
            default:
              toast.error('Acción de workflow no implementada')
          }
        }
        break

      case 'navigate':
        switch (action) {
          case 'dashboard':
            router.push('/dashboard')
            break
          case 'workflows':
            router.push('/workflows')
            break
          case 'settings':
            router.push('/settings')
            break
          case 'ai-history':
            router.push('/ai/history')
            break
          default:
            toast.error('Navegación no implementada')
        }
        break

      case 'system':
        switch (action) {
          case 'search':
            router.push('/search')
            break
          case 'docs':
            window.open('https://docs.rp9.io', '_blank')
            break
          case 'shortcuts':
            toast.info('Atajos de teclado', {
              description: 'Cmd+K: Command Palette, /: Buscar, ?: Ayuda'
            })
            break
          default:
            toast.error('Acción de sistema no implementada')
        }
        break

      default:
        toast.error('Comando no reconocido')
    }

    // Close palette after command execution
    setIsOpen(false)
  }, [options, router])

  return {
    isOpen,
    openPalette,
    closePalette,
    handleCommandSelect,
    setIsOpen
  }
}