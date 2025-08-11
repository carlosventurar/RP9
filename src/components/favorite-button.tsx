'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Heart, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface FavoriteButtonProps {
  itemId: string
  itemType: 'template' | 'collection'
  itemName?: string
  initialIsFavorited?: boolean
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  showText?: boolean
  className?: string
  onFavoriteChange?: (isFavorited: boolean) => void
}

export function FavoriteButton({
  itemId,
  itemType,
  itemName,
  initialIsFavorited = false,
  variant = 'ghost',
  size = 'icon',
  showText = false,
  className = '',
  onFavoriteChange
}: FavoriteButtonProps) {
  const { token, isAuthenticated } = useAuth()
  
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if item is favorited when component mounts (if authenticated)
  useEffect(() => {
    if (isAuthenticated && token && mounted) {
      checkFavoriteStatus()
    }
  }, [isAuthenticated, token, mounted, itemId])

  const checkFavoriteStatus = async () => {
    try {
      const response = await fetch(`/api/favorites?type=${itemType}s&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const favorites = itemType === 'template' 
            ? data.data.favorites.templates 
            : data.data.favorites.collections
          
          const isFav = favorites.some((fav: any) => fav.id === itemId)
          setIsFavorited(isFav)
        }
      }
    } catch (error) {
      console.error('Error checking favorite status:', error)
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isAuthenticated) {
      toast.error('Please sign in to save favorites')
      return
    }

    setIsLoading(true)

    try {
      if (isFavorited) {
        // Remove from favorites
        const response = await fetch('/api/favorites', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            item_id: itemId,
            item_type: itemType
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setIsFavorited(false)
          onFavoriteChange?.(false)
          
          toast.success(`${itemName || itemType.charAt(0).toUpperCase() + itemType.slice(1)} removed from favorites`)
        } else {
          throw new Error(data.error || 'Failed to remove favorite')
        }
      } else {
        // Add to favorites
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            item_id: itemId,
            item_type: itemType
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setIsFavorited(true)
          onFavoriteChange?.(true)
          
          toast.success(`${itemName || itemType.charAt(0).toUpperCase() + itemType.slice(1)} added to favorites`)
        } else if (response.status === 400 && data.error.includes('already favorited')) {
          // Item already favorited, update UI state
          setIsFavorited(true)
          onFavoriteChange?.(true)
        } else {
          throw new Error(data.error || 'Failed to add favorite')
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update favorites')
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
          ? 'Updating...' 
          : isFavorited 
          ? `Remove ${itemName || itemType} from favorites` 
          : `Add ${itemName || itemType} to favorites`
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
          {isFavorited ? 'Favorited' : 'Favorite'}
        </span>
      )}
      
      {showText && isLoading && (
        <span className="ml-2">Updating...</span>
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