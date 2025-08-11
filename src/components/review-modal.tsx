'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { 
  Star,
  Loader2,
  CheckCircle,
  AlertCircle,
  MessageSquare
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface Template {
  id: string
  name: string
  description: string
  category: string
}

interface ReviewModalProps {
  template: Template | null
  isOpen: boolean
  onClose: () => void
  onReviewSubmitted?: (templateId: string, rating: number) => void
}

export function ReviewModal({ 
  template, 
  isOpen, 
  onClose, 
  onReviewSubmitted 
}: ReviewModalProps) {
  const { token, isAuthenticated } = useAuth()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!template) return null

  const handleSubmit = async () => {
    if (!isAuthenticated || !token) {
      setError('Please log in to submit a review')
      return
    }

    if (rating === 0) {
      setError('Please select a rating')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/template-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId: template.id,
          rating,
          comment: comment.trim() || null
        })
      })

      const data = await response.json()

      if (data.success) {
        setSubmitStatus('success')
        if (onReviewSubmitted) {
          onReviewSubmitted(template.id, rating)
        }
        
        // Auto-close after success
        setTimeout(() => {
          handleClose()
        }, 2000)
      } else {
        throw new Error(data.error || 'Failed to submit review')
      }

    } catch (error) {
      console.error('Review submission error:', error)
      setError(error instanceof Error ? error.message : 'Failed to submit review')
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setRating(0)
    setHoverRating(0)
    setComment('')
    setIsSubmitting(false)
    setSubmitStatus('idle')
    setError(null)
    onClose()
  }

  const renderStars = () => {
    return [...Array(5)].map((_, index) => {
      const starNumber = index + 1
      const isFilled = starNumber <= (hoverRating || rating)
      
      return (
        <button
          key={index}
          type="button"
          className={`text-2xl transition-colors duration-200 hover:scale-110 ${
            isFilled ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
          }`}
          onMouseEnter={() => setHoverRating(starNumber)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => setRating(starNumber)}
          disabled={isSubmitting || submitStatus === 'success'}
        >
          <Star 
            className="w-8 h-8" 
            fill={isFilled ? 'currentColor' : 'none'}
          />
        </button>
      )
    })
  }

  const ratingLabels = {
    1: 'Poor - Not recommended',
    2: 'Fair - Below expectations',
    3: 'Good - Meets expectations',
    4: 'Very Good - Exceeds expectations', 
    5: 'Excellent - Outstanding template'
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 bg-blue-500/20 p-2 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Review Template
              </DialogTitle>
              <DialogDescription className="mt-1">
                Help other users by sharing your experience with this template
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Info */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {template.description}
            </p>
            <div className="text-xs text-muted-foreground">
              Category: {template.category}
            </div>
          </div>

          {/* Success/Error States */}
          {submitStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <CheckCircle className="w-5 h-5" />
              <span>Thank you! Your review has been submitted successfully.</span>
            </div>
          )}

          {submitStatus !== 'success' && (
            <>
              {/* Rating */}
              <div className="space-y-3">
                <h4 className="font-medium">Your Rating</h4>
                <div className="flex items-center gap-1">
                  {renderStars()}
                </div>
                {(hoverRating || rating) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {ratingLabels[(hoverRating || rating) as keyof typeof ratingLabels]}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div className="space-y-3">
                <h4 className="font-medium">Your Review (Optional)</h4>
                <Textarea
                  placeholder="Share your experience with this template... What did you like? How did it help your workflow?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={500}
                  disabled={isSubmitting}
                  className="resize-none"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Help others understand what makes this template useful</span>
                  <span>{comment.length}/500</span>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="w-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || rating === 0 || !isAuthenticated}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </Button>
              </div>

              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground text-center">
                  Please log in to submit a review
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}