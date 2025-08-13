'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ReviewsList } from '@/components/reviews-list'
import { ReviewModal } from '@/components/review-modal'
import { 
  ArrowLeft, 
  Star, 
  MessageSquarePlus,
  TrendingUp,
  Users
} from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
  category: string
  rating: number
  install_count: number
}

export default function TemplateReviewsPage() {
  const params = useParams()
  const router = useRouter()
  // Use "slug" to match the segment name under /templates/[slug]
  const templateKey = params?.slug as string

  const [template, setTemplate] = useState<Template | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateKey) return

      try {
        // Fetch template details (for now our mock API supports lookup by id param)
        const response = await fetch(`/api/templates?id=${templateKey}`)
        const data = await response.json()

        if (data.success && data.data.length > 0) {
          setTemplate(data.data[0])
        }
      } catch (error) {
        console.error('Error fetching template:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplate()
  }, [templateKey])

  const handleReviewSubmitted = () => {
    setReviewModalOpen(false)
    // Trigger reviews refresh by re-mounting the component
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Template not found</p>
          <Button 
            variant="outline" 
            onClick={() => router.push('/templates')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/templates')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
          
          <Button 
            onClick={() => setReviewModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Write Review
          </Button>
        </div>

        {/* Template Info Header */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{template.name}</h1>
                <p className="text-muted-foreground leading-relaxed">
                  {template.description}
                </p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-6 pt-4 border-t border-blue-500/10">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.round(template.rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold">{template.rating.toFixed(1)}</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{template.install_count.toLocaleString()} installs</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                <span>{template.category}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="bg-card border rounded-lg p-6">
        <ReviewsList 
          templateId={templateKey}
          showTitle={true}
        />
      </div>

      {/* Review Modal */}
      <ReviewModal
        template={template}
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </div>
  )
}

