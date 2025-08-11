'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Heart, Loader2 } from 'lucide-react'
interface FavoriteButtonProps {
  templateId: string
  templateName?: string
  initialIsFavorited?: boolean
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  showText?: boolean
  className?: string
  onFavoriteChange?: (isFavorited: boolean) => void
}

export function FavoriteButton({
  templateId,
  templateName,
  initialIsFavorited = false,
  variant = 'ghost',
  size = 'icon',
  showText = false,
  className = '',
  onFavoriteChange
}: FavoriteButtonProps) {
  
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if template is favorited when component mounts
  useEffect(() => {
    if (mounted && templateId) {
      checkFavoriteStatus()
    }
  }, [mounted, templateId])

  const checkFavoriteStatus = async () => {
    try {
      const response = await fetch('/api/favorites')

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const isFav = data.data.favorites.some((fav: any) => fav.id === templateId)
          setIsFavorited(isFav)
        }
      }
    } catch (error) {
      // User might not be authenticated, ignore error
      console.log('Could not check favorite status:', error)
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsLoading(true)

    try {
      if (isFavorited) {
        // Remove from favorites
        const response = await fetch('/api/favorites', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: templateId
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setIsFavorited(false)
          onFavoriteChange?.(false)
          toast.success(`${templateName || 'Template'} removido de favoritos`)
        } else {
          throw new Error(data.error || 'Error al remover favorito')
        }
      } else {
        // Add to favorites
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: templateId
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setIsFavorited(true)
          onFavoriteChange?.(true)
          toast.success(`${templateName || 'Template'} agregado a favoritos`)
        } else if (response.status === 409) {
          // Already favorited, update UI state
          setIsFavorited(true)
          onFavoriteChange?.(true)
          toast.info('Ya está en favoritos')
        } else if (response.status === 401) {
          toast.error('Por favor inicia sesión para guardar favoritos')
        } else {
          throw new Error(data.error || 'Error al agregar favorito')
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast.error(error instanceof Error ? error.message : 'Error al actualizar favoritos')
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) {
    // Return a placeholder during hydration to avoid mismatch
    return (
      <Button
        variant={variant}
        size={size}
        className={`${className} opacity-50`}
        disabled
      >
        <Heart className="w-4 h-4" />
        {showText && <span className="ml-2">Favorite</span>}
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={`transition-colors ${className} ${
        isFavorited 
          ? 'text-red-500 hover:text-red-600' 
          : 'text-muted-foreground hover:text-red-500'
      }`}
      onClick={handleToggleFavorite}
      disabled={isLoading}
      title={
        isLoading 
          ? 'Actualizando...' 
          : isFavorited 
          ? `Remover ${templateName || 'template'} de favoritos` 
          : `Agregar ${templateName || 'template'} a favoritos`
      }
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Heart 
          className={`w-4 h-4 transition-all ${
            isFavorited ? 'fill-current scale-110' : ''
          }`} 
        />
      )}
      
      {showText && !isLoading && (
        <span className="ml-2">
          {isFavorited ? 'En Favoritos' : 'Favorito'}
        </span>
      )}
      
      {showText && isLoading && (
        <span className="ml-2">Actualizando...</span>
      )}
    </Button>
  )
}

// Preset variants for common use cases
export function FavoriteIconButton(props: Omit<FavoriteButtonProps, 'size' | 'showText'>) {
  return <FavoriteButton {...props} size="icon" showText={false} />
}

export function FavoriteTextButton(props: Omit<FavoriteButtonProps, 'size' | 'showText'>) {
  return <FavoriteButton {...props} size="default" showText={true} />
}

export function FavoriteCompactButton(props: Omit<FavoriteButtonProps, 'size' | 'showText'>) {
  return <FavoriteButton {...props} size="sm" showText={true} />
}