'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Star,
  ThumbsUp,
  MessageSquare,
  Calendar,
  User,
  Loader2,
  TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'

interface Review {
  id: string
  user_id: string
  rating: number
  comment: string | null
  helpful_count: number
  created_at: string
  updated_at: string
  user_email?: string
  user_name?: string
  user_has_helped?: boolean
}

interface ReviewsListProps {
  templateId: string
  className?: string
  showTitle?: boolean
  limit?: number
}

export function ReviewsList({ 
  templateId, 
  className = '', 
  showTitle = true,
  limit 
}: ReviewsListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [helpfulLoading, setHelpfulLoading] = useState<string | null>(null)

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/template-reviews?templateId=${templateId}${limit ? `&limit=${limit}` : ''}`)
      const data = await response.json()

      if (data.success) {
        setReviews(data.data || [])
      } else {
        throw new Error(data.error || 'Failed to fetch reviews')
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch reviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (templateId) {
      fetchReviews()
    }
  }, [templateId])

  const handleHelpful = async (reviewId: string, isHelpful: boolean) => {
    setHelpfulLoading(reviewId)

    try {
      const response = await fetch('/api/review-helpful', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewId,
          isHelpful
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        setReviews(prev => prev.map(review => 
          review.id === reviewId 
            ? { 
                ...review, 
                helpful_count: data.data.helpful_count,
                user_has_helped: data.data.user_voted
              }
            : review
        ))
        toast.success(isHelpful ? 'Marcado como útil' : 'Voto removido')
      } else {
        throw new Error(data.error || 'Error al actualizar utilidad')
      }

    } catch (error) {
      console.error('Error updating helpfulness:', error)
      toast.error(error instanceof Error ? error.message : 'Error al actualizar utilidad')
    } finally {
      setHelpfulLoading(null)
    }
  }

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getUserDisplayName = (review: Review) => {
    if (review.user_name) return review.user_name
    if (review.user_email) {
      // Show first part of email with anonymization
      const emailPart = review.user_email.split('@')[0]
      return emailPart.length > 3 
        ? `${emailPart.slice(0, 3)}***`
        : 'Anonymous User'
    }
    return 'Anonymous User'
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showTitle && (
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Reviews</h3>
          </div>
        )}
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showTitle && (
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Reviews</h3>
          </div>
        )}
        <div className="text-center py-8 text-muted-foreground">
          <p>Unable to load reviews</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchReviews}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showTitle && (
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Reviews</h3>
            <Badge variant="secondary">0</Badge>
          </div>
        )}
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No reviews yet</p>
          <p className="text-sm">Be the first to share your experience!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showTitle && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Reviews</h3>
            <Badge variant="secondary">{reviews.length}</Badge>
          </div>
          
          {/* Rating Summary */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="flex">{renderStars(Math.round(averageRating))}</div>
              <span className="font-semibold">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span>{Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100)}% positive</span>
            </div>
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border rounded-lg p-4 space-y-3">
            {/* Review Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {getUserDisplayName(review)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(review.created_at)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {renderStars(review.rating)}
              </div>
            </div>

            {/* Review Comment */}
            {review.comment && (
              <div className="text-sm leading-relaxed">
                {review.comment}
              </div>
            )}

            {/* Review Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleHelpful(review.id, !review.user_has_helped)}
                  disabled={helpfulLoading === review.id}
                  className={`text-xs h-auto py-1 px-2 ${
                    review.user_has_helped ? 'text-blue-600' : 'text-muted-foreground'
                  }`}
                >
                  {helpfulLoading === review.id ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <ThumbsUp className="w-3 h-3 mr-1" />
                  )}
                  Helpful {review.helpful_count > 0 && `(${review.helpful_count})`}
                </Button>
              </div>
              
              {review.rating >= 4 && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  Recommended
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show More Button if limited */}
      {limit && reviews.length === limit && (
        <div className="text-center pt-4">
          <Button 
            variant="outline"
            onClick={() => fetchReviews()}
          >
            Show All Reviews
          </Button>
        </div>
      )}
    </div>
  )
}