'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  Bug, 
  Zap, 
  MessageSquare,
  Search,
  FileText,
  Settings,
  History,
  Plus,
  PlayCircle,
  PauseCircle,
  Code,
  Database,
  Globe,
  Keyboard
} from 'lucide-react'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCommandSelect: (command: AICommand) => void
}

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

export function CommandPalette({ open, onOpenChange, onCommandSelect }: CommandPaletteProps) {
  const t = useTranslations('commandPalette')
  const [searchQuery, setSearchQuery] = useState('')

  // Define all available commands
  const commands: AICommand[] = [
    // AI Commands
    {
      id: 'ai-generate-workflow',
      title: 'Generar Workflow con IA',
      description: 'Crear un nuevo workflow desde un prompt natural',
      category: 'ai',
      icon: Sparkles,
      shortcut: ['g', 'w'],
      action: 'ai:generate',
      premium: false
    },
    {
      id: 'ai-explain-error',
      title: 'Explicar Error',
      description: 'Analizar y explicar errores de ejecución',
      category: 'ai',
      icon: Bug,
      shortcut: ['e', 'x'],
      action: 'ai:explain',
      premium: false
    },
    {
      id: 'ai-optimize-workflow',
      title: 'Optimizar Workflow',
      description: 'Sugerir mejoras de performance y eficiencia',
      category: 'ai',
      icon: Zap,
      shortcut: ['o', 'p'],
      action: 'ai:optimize',
      premium: true
    },
    {
      id: 'ai-chat',
      title: 'Chat con AI Assistant',
      description: 'Hacer preguntas al asistente de IA',
      category: 'ai',
      icon: MessageSquare,
      shortcut: ['c', 'h'],
      action: 'ai:chat',
      premium: false
    },
    {
      id: 'ai-history',
      title: 'Historial de IA',
      description: 'Ver conversaciones anteriores con el AI',
      category: 'ai',
      icon: History,
      action: 'navigate:ai-history',
      premium: false
    },

    // Workflow Commands
    {
      id: 'workflow-new',
      title: 'Nuevo Workflow',
      description: 'Crear un workflow desde cero',
      category: 'workflow',
      icon: Plus,
      shortcut: ['n', 'w'],
      action: 'workflow:new',
      premium: false
    },
    {
      id: 'workflow-run',
      title: 'Ejecutar Workflow',
      description: 'Ejecutar el workflow actual',
      category: 'workflow',
      icon: PlayCircle,
      shortcut: ['r', 'u'],
      action: 'workflow:run',
      premium: false
    },
    {
      id: 'workflow-stop',
      title: 'Detener Workflow',
      description: 'Detener la ejecución actual',
      category: 'workflow',
      icon: PauseCircle,
      shortcut: ['s', 't'],
      action: 'workflow:stop',
      premium: false
    },

    // Navigation Commands
    {
      id: 'nav-dashboard',
      title: 'Dashboard',
      description: 'Ir al dashboard principal',
      category: 'navigation',
      icon: Database,
      shortcut: ['g', 'd'],
      action: 'navigate:dashboard',
      premium: false
    },
    {
      id: 'nav-workflows',
      title: 'Workflows',
      description: 'Ver todos los workflows',
      category: 'navigation',
      icon: Code,
      shortcut: ['g', 'w'],
      action: 'navigate:workflows',
      premium: false
    },
    {
      id: 'nav-settings',
      title: 'Configuración',
      description: 'Configurar cuenta y preferencias',
      category: 'navigation',
      icon: Settings,
      shortcut: ['g', 's'],
      action: 'navigate:settings',
      premium: false
    },

    // System Commands
    {
      id: 'system-search',
      title: 'Buscar en Todo',
      description: 'Búsqueda global en workflows y datos',
      category: 'system',
      icon: Search,
      shortcut: ['/', '/'],
      action: 'system:search',
      premium: false
    },
    {
      id: 'system-docs',
      title: 'Documentación',
      description: 'Abrir documentación de RP9',
      category: 'system',
      icon: FileText,
      action: 'system:docs',
      premium: false
    },
    {
      id: 'system-shortcuts',
      title: 'Atajos de Teclado',
      description: 'Ver todos los atajos disponibles',
      category: 'system',
      icon: Keyboard,
      shortcut: ['?', '?'],
      action: 'system:shortcuts',
      premium: false
    }
  ]

  // Filter commands based on search
  const filteredCommands = commands.filter(command => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    return (
      command.title.toLowerCase().includes(searchLower) ||
      command.description.toLowerCase().includes(searchLower) ||
      command.category.toLowerCase().includes(searchLower)
    )
  })

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((groups, command) => {
    const category = command.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(command)
    return groups
  }, {} as Record<string, AICommand[]>)

  // Handle command selection
  const handleCommandSelect = useCallback((command: AICommand) => {
    onCommandSelect(command)
    onOpenChange(false)
    setSearchQuery('')
  }, [onCommandSelect, onOpenChange])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Open command palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(true)
        return
      }

      // Open with forward slash
      if (e.key === '/' && !open) {
        e.preventDefault()
        onOpenChange(true)
        return
      }

      // Close with Escape
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  const getCategoryLabel = (category: string): string => {
    const labels = {
      ai: 'AI Assistant',
      workflow: 'Workflows',
      navigation: 'Navegación',
      system: 'Sistema'
    }
    return labels[category as keyof typeof labels] || category
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      ai: Sparkles,
      workflow: Code,
      navigation: Globe,
      system: Settings
    }
    const Icon = icons[category as keyof typeof icons] || Settings
    return <Icon className="h-4 w-4" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl">
        <Command className="rounded-lg border shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Buscar comandos... (Prueba 'generar workflow' o 'optimizar')"
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="border-0 focus:ring-0"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Cmd</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">K</kbd>
            </div>
          </div>

          <CommandList className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>
              <div className="text-center py-6">
                <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No se encontraron comandos para "{searchQuery}"
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prueba con 'generar', 'optimizar', o 'explicar'
                </p>
              </div>
            </CommandEmpty>

            {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <CommandGroup 
                key={category}
                heading={
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    {getCategoryLabel(category)}
                  </div>
                }
              >
                {categoryCommands.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={() => handleCommandSelect(command)}
                    className="flex items-center gap-3 p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-md bg-muted">
                        <command.icon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{command.title}</span>
                          {command.premium && (
                            <Badge variant="secondary" className="text-xs">
                              Pro
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {command.description}
                        </p>
                      </div>
                    </div>

                    {command.shortcut && (
                      <div className="flex items-center gap-1">
                        {command.shortcut.map((key, index) => (
                          <kbd 
                            key={index} 
                            className="px-1.5 py-0.5 bg-muted rounded text-xs"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>

          <div className="border-t p-2 text-xs text-muted-foreground bg-muted/50">
            <div className="flex items-center justify-between">
              <span>Presiona Enter para seleccionar</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-background rounded">↑↓</kbd>
                  para navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-background rounded">Esc</kbd>
                  para cerrar
                </span>
              </div>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export default CommandPalette