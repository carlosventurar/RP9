'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Trophy, 
  Star, 
  Target, 
  Flame, 
  Award, 
  Zap,
  Crown,
  Medal,
  Sparkles,
  TrendingUp
} from 'lucide-react'

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  unlocked: boolean
  progress?: number
  maxProgress?: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface ProgressLevel {
  level: number
  title: string
  description: string
  minScore: number
  color: string
  icon: React.ComponentType<{ className?: string }>
}

interface ProgressGamificationProps {
  healthScore: number
  tasksCompleted: number
  totalTasks: number
  isActivated: boolean
  daysSinceSignup: number
  className?: string
}

const PROGRESS_LEVELS: ProgressLevel[] = [
  {
    level: 1,
    title: 'Explorador',
    description: 'Comenzando el viaje',
    minScore: 0,
    color: 'text-gray-600',
    icon: Target
  },
  {
    level: 2,
    title: 'Aprendiz',
    description: 'Primeros pasos completados',
    minScore: 20,
    color: 'text-blue-600',
    icon: Star
  },
  {
    level: 3,
    title: 'Practicante',
    description: 'Ganando experiencia',
    minScore: 40,
    color: 'text-green-600',
    icon: Zap
  },
  {
    level: 4,
    title: 'Experto',
    description: 'Dominando las automatizaciones',
    minScore: 70,
    color: 'text-purple-600',
    icon: Award
  },
  {
    level: 5,
    title: 'Maestro',
    description: 'Cuenta completamente activada',
    minScore: 90,
    color: 'text-yellow-600',
    icon: Crown
  }
]

export default function ProgressGamification({
  healthScore,
  tasksCompleted,
  totalTasks,
  isActivated,
  daysSinceSignup,
  className = ''
}: ProgressGamificationProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [currentLevel, setCurrentLevel] = useState<ProgressLevel>(PROGRESS_LEVELS[0])
  const [nextLevel, setNextLevel] = useState<ProgressLevel | null>(null)

  useEffect(() => {
    calculateLevel()
    generateAchievements()
  }, [healthScore, tasksCompleted, isActivated, daysSinceSignup])

  const calculateLevel = () => {
    // Find current level based on health score
    let level = PROGRESS_LEVELS[0]
    let next = null

    for (let i = PROGRESS_LEVELS.length - 1; i >= 0; i--) {
      if (healthScore >= PROGRESS_LEVELS[i].minScore) {
        level = PROGRESS_LEVELS[i]
        next = i < PROGRESS_LEVELS.length - 1 ? PROGRESS_LEVELS[i + 1] : null
        break
      }
    }

    setCurrentLevel(level)
    setNextLevel(next)
  }

  const generateAchievements = () => {
    const newAchievements: Achievement[] = [
      {
        id: 'first_step',
        title: 'Primer Paso',
        description: 'Completaste tu primera tarea',
        icon: Star,
        unlocked: tasksCompleted > 0,
        rarity: 'common'
      },
      {
        id: 'early_bird',
        title: 'Madrugador',
        description: 'Completaste 3 tareas en tu primer día',
        icon: Flame,
        unlocked: tasksCompleted >= 3 && daysSinceSignup <= 1,
        rarity: 'rare'
      },
      {
        id: 'task_master',
        title: 'Maestro de Tareas',
        description: 'Completaste el 50% de las tareas',
        icon: Target,
        unlocked: (tasksCompleted / totalTasks) >= 0.5,
        progress: tasksCompleted,
        maxProgress: Math.ceil(totalTasks * 0.5),
        rarity: 'epic'
      },
      {
        id: 'perfectionist',
        title: 'Perfeccionista',
        description: 'Completaste todas las tareas',
        icon: Trophy,
        unlocked: tasksCompleted === totalTasks,
        progress: tasksCompleted,
        maxProgress: totalTasks,
        rarity: 'legendary'
      },
      {
        id: 'activated',
        title: 'Activado',
        description: 'Tu cuenta está completamente activada',
        icon: Sparkles,
        unlocked: isActivated,
        rarity: 'epic'
      },
      {
        id: 'health_champion',
        title: 'Campeón de Salud',
        description: 'Alcanzaste un Health Score de 80+',
        icon: Medal,
        unlocked: healthScore >= 80,
        progress: healthScore,
        maxProgress: 80,
        rarity: 'rare'
      },
      {
        id: 'speed_runner',
        title: 'Velocista',
        description: 'Te activaste en menos de 3 días',
        icon: TrendingUp,
        unlocked: isActivated && daysSinceSignup <= 3,
        rarity: 'legendary'
      }
    ]

    setAchievements(newAchievements)
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-300 bg-gray-50 text-gray-700'
      case 'rare': return 'border-blue-300 bg-blue-50 text-blue-700'
      case 'epic': return 'border-purple-300 bg-purple-50 text-purple-700'
      case 'legendary': return 'border-yellow-300 bg-yellow-50 text-yellow-700'
      default: return 'border-gray-300 bg-gray-50 text-gray-700'
    }
  }

  const getRarityBadgeColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800'
      case 'rare': return 'bg-blue-100 text-blue-800'
      case 'epic': return 'bg-purple-100 text-purple-800'
      case 'legendary': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const unlockedAchievements = achievements.filter(a => a.unlocked)
  const progressPercent = nextLevel ? 
    ((healthScore - currentLevel.minScore) / (nextLevel.minScore - currentLevel.minScore)) * 100 : 100

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Level Progress */}
      <Card className="border-2 border-dashed border-blue-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full bg-blue-100`}>
                <currentLevel.icon className={`w-6 h-6 ${currentLevel.color}`} />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Nivel {currentLevel.level}: {currentLevel.title}
                </CardTitle>
                <CardDescription>
                  {currentLevel.description}
                </CardDescription>
              </div>
            </div>
            <Badge className={`${getRarityBadgeColor('epic')} text-sm px-3 py-1`}>
              {healthScore} pts
            </Badge>
          </div>
        </CardHeader>
        
        {nextLevel && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso al siguiente nivel</span>
                <span className="font-medium">
                  {healthScore}/{nextLevel.minScore} pts
                </span>
              </div>
              <Progress value={Math.min(progressPercent, 100)} className="h-3" />
              <div className="text-xs text-muted-foreground text-center">
                Siguiente: {nextLevel.title} • Necesitas {nextLevel.minScore - healthScore} puntos más
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Achievements Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Logros
          </CardTitle>
          <CardDescription>
            {unlockedAchievements.length} de {achievements.length} logros desbloqueados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  achievement.unlocked 
                    ? getRarityColor(achievement.rarity)
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    achievement.unlocked ? 'bg-white' : 'bg-gray-300'
                  }`}>
                    <achievement.icon className={`w-4 h-4 ${
                      achievement.unlocked ? currentLevel.color : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {achievement.title}
                      </h4>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getRarityBadgeColor(achievement.rarity)}`}
                      >
                        {achievement.rarity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {achievement.description}
                    </p>
                    
                    {achievement.progress !== undefined && achievement.maxProgress && (
                      <div className="space-y-1">
                        <Progress 
                          value={(achievement.progress / achievement.maxProgress) * 100} 
                          className="h-1"
                        />
                        <div className="text-xs text-muted-foreground">
                          {achievement.progress}/{achievement.maxProgress}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{tasksCompleted}</div>
            <div className="text-xs text-muted-foreground">Tareas completadas</div>
          </CardContent>
        </Card>
        
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{healthScore}</div>
            <div className="text-xs text-muted-foreground">Health Score</div>
          </CardContent>
        </Card>
        
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-600">{unlockedAchievements.length}</div>
            <div className="text-xs text-muted-foreground">Logros desbloqueados</div>
          </CardContent>
        </Card>
        
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{daysSinceSignup}</div>
            <div className="text-xs text-muted-foreground">Días activo</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}