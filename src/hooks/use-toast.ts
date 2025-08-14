'use client'

import { toast as sonnerToast } from 'sonner'

// Types compatible with shadcn/ui toast
interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

// Hook that provides shadcn/ui compatible API using sonner
export function useToast() {
  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'default', duration = 4000 } = options

    // Build message content
    let message = title || ''
    
    // Combine title and description if both exist
    if (title && description) {
      message = title
    } else if (description && !title) {
      message = description
    }

    // Map variants to sonner methods
    switch (variant) {
      case 'destructive':
        return sonnerToast.error(message, {
          description: title && description ? description : undefined,
          duration
        })
        
      case 'success':
        return sonnerToast.success(message, {
          description: title && description ? description : undefined,
          duration
        })
        
      default:
        return sonnerToast(message, {
          description: title && description ? description : undefined,
          duration
        })
    }
  }

  return { toast }
}

// Export default for convenience
export default useToast